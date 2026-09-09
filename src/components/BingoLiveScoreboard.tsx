import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchBoardTasks } from '../lib/boardCards'
import { computeBingoStandings, sortBingoStandings, type BingoStandingRow } from '../lib/bingoStandings'
import type { BingoTask, BingoTeam, BingoScan, BingoDuel } from '../types/database'

/**
 * The projector scoreboard, shrunk to a phone — so players and observers can
 * see where their group stands without walking back to the screen. Ranking is
 * shared with the projector (lib/bingoStandings) so the two always agree.
 */
export function BingoLiveScoreboard({
  sectionId,
  highlightTeamId,
}: {
  sectionId: string
  /** The viewer's own group — outlined so it's findable at a glance. */
  highlightTeamId?: string
}) {
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [gridTasks, setGridTasks] = useState<BingoTask[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [duels, setDuels] = useState<BingoDuel[]>([])
  const [showBonus, setShowBonus] = useState(false)
  const [loading, setLoading] = useState(true)

  // Scans carry no section_id, so they're fetched by this section's team ids.
  const loadScans = async (teamIds: string[]) => {
    if (teamIds.length === 0) { setScans([]); return }
    const { data } = await supabase.from('bingo_scans').select('*').in('team_id', teamIds)
    if (data) setScans(data)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [teamsRes, duelsRes, tasks] = await Promise.all([
        supabase.from('bingo_teams').select('*').eq('section_id', sectionId).order('created_at'),
        supabase.from('bingo_duels').select('*').eq('section_id', sectionId).eq('status', 'done'),
        fetchBoardTasks(sectionId),
      ])
      if (cancelled) return
      const loadedTeams = teamsRes.data ?? []
      setTeams(loadedTeams)
      setDuels(duelsRes.data ?? [])
      setGridTasks(tasks)
      await loadScans(loadedTeams.map(t => t.id))
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [sectionId])

  // Live updates. bingo_scans can't be server-filtered by a list of teams, so
  // any scan change triggers a refetch scoped to this section's teams.
  const teamIdsKey = teams.map(t => t.id).join(',')
  useEffect(() => {
    const teamIds = teamIdsKey ? teamIdsKey.split(',') : []
    if (teamIds.length === 0) return
    const channel = supabase
      .channel(`bingo-live-scoreboard-${sectionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_scans' }, () => {
        loadScans(teamIds)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_teams', filter: `section_id=eq.${sectionId}` }, async () => {
        const { data } = await supabase.from('bingo_teams').select('*').eq('section_id', sectionId).order('created_at')
        if (data) setTeams(data)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_duels', filter: `section_id=eq.${sectionId}` }, async () => {
        const { data } = await supabase.from('bingo_duels').select('*').eq('section_id', sectionId).eq('status', 'done')
        if (data) setDuels(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sectionId, teamIdsKey])

  // iOS Safari kills the socket when the phone locks, so poll as a fallback —
  // the same self-healing the board itself relies on.
  useEffect(() => {
    const teamIds = teamIdsKey ? teamIdsKey.split(',') : []
    if (teamIds.length === 0) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadScans(teamIds)
    }, 8000)
    return () => clearInterval(id)
  }, [teamIdsKey])

  const rows: BingoStandingRow[] = sortBingoStandings(
    computeBingoStandings({ teams, gridTasks, scans, duels }),
    showBonus,
  )
  // The manual award-ceremony bonus only exists once a marshal has given some,
  // so the toggle stays out of the way until it means something.
  const anyBonus = rows.some(r => r.bonus > 0)

  if (loading) {
    return <div className="text-center py-16 text-gray-500 font-bold animate-pulse">Loading scoreboard...</div>
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">🎯</div>
        <p className="font-bold">No groups registered yet</p>
      </div>
    )
  }

  const rankColors = ['#fbbf24', '#cbd5e1', '#d97706']

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-gray-500 text-[11px] font-black uppercase tracking-widest">
          {rows.length} groups &middot; live
        </p>
        {anyBonus && (
          <button
            onClick={() => setShowBonus(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              showBonus
                ? 'bg-amber-400 text-gray-950'
                : 'bg-white/10 text-amber-300 border border-amber-700/50'
            }`}
          >
            {showBonus ? '✓ With Bonus' : '＋ With Bonus'}
          </button>
        )}
      </div>

      {rows.map((row, i) => {
        const rank = i + 1
        const isTop3 = rank <= 3
        const rankColor = isTop3 ? rankColors[rank - 1] : '#4b5563'
        const isMine = row.team.id === highlightTeamId
        return (
          <div
            key={row.team.id}
            className="grid grid-cols-[40px_1fr_auto] gap-3 items-center px-3 py-3 rounded-2xl transition-all duration-500"
            style={{
              background: isTop3
                ? `linear-gradient(90deg, ${rankColor}22 0%, rgba(255,255,255,0.03) 100%)`
                : 'rgba(255,255,255,0.04)',
              border: isMine
                ? '1px solid rgba(168,85,247,0.7)'
                : isTop3 ? `1px solid ${rankColor}55` : '1px solid rgba(255,255,255,0.05)',
              boxShadow: isMine ? '0 0 20px rgba(168,85,247,0.25)' : 'none',
            }}
          >
            <div className="text-xl font-black tabular-nums text-center" style={{ color: rankColor }}>
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-white text-base font-black tracking-tight truncate">{row.team.name}</p>
                {isMine && (
                  <span className="flex-shrink-0 text-purple-300 text-[9px] font-black uppercase tracking-wider bg-purple-900/50 px-1.5 py-0.5 rounded">You</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] font-bold">
                <span className="text-amber-400">{row.bingos}<span className="text-gray-600">/12 lines</span></span>
                <span className="text-green-400">{row.tasksDone}<span className="text-gray-600"> done</span></span>
                {!showBonus && row.duelBonus > 0 && (
                  // Surface duel winnings — otherwise a defender who won reads
                  // as having scored from nowhere.
                  <span className="text-red-300">+{row.duelBonus} duel</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-white text-2xl font-black tabular-nums leading-none">
                {showBonus ? row.points + row.bonus : row.points}
              </p>
              {showBonus ? (
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1">
                  <span className="text-violet-300">{row.points}</span>
                  <span className="text-gray-600"> + </span>
                  <span className="text-amber-400">{row.bonus}</span>
                </p>
              ) : (
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">pts</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
