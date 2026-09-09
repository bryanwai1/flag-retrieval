import { useEffect, useRef, useState } from 'react'
import type { BingoStandings } from '../hooks/useBingoStandings'
import { sortBingoStandings } from '../lib/bingoStandings'

/**
 * The projector scoreboard, shrunk to a phone — so players and observers can
 * see where their group stands without walking back to the screen. Ranking is
 * shared with the projector (lib/bingoStandings) so the two always agree.
 */
export function BingoLiveScoreboard({
  standings: { rows: rawRows, loading },
  highlightTeamId,
}: {
  /** Loaded once by the board (useBingoStandings) and shared with the strip. */
  standings: BingoStandings
  /** The viewer's own group — outlined so it's findable at a glance. */
  highlightTeamId?: string
}) {
  const [showBonus, setShowBonus] = useState(false)

  const rows = sortBingoStandings([...rawRows], showBonus)
  // The manual award-ceremony bonus only exists once a marshal has given some,
  // so the toggle stays out of the way until it means something.
  const anyBonus = rows.some(r => r.bonus > 0)

  // Overtaking is the part of a scoreboard people care about, and on a phone
  // the reorder alone is easy to miss — a group that just moved carries a
  // ▲/▼ chip for a few seconds so the change is legible.
  const orderKey = rows.map(r => r.team.id).join(',')
  const prevRanksRef = useRef<Map<string, number> | null>(null)
  const lastBonusModeRef = useRef(showBonus)
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  useEffect(() => {
    const current = new Map(rows.map((r, i) => [r.team.id, i + 1]))
    // Flipping the bonus view reshuffles everything without anyone scoring,
    // so re-baseline instead of claiming a dozen overtakes.
    const bonusModeChanged = lastBonusModeRef.current !== showBonus
    lastBonusModeRef.current = showBonus
    if (prevRanksRef.current === null || bonusModeChanged) {
      prevRanksRef.current = current
      return
    }
    const moved: Record<string, number> = {}
    current.forEach((rank, id) => {
      const before = prevRanksRef.current!.get(id)
      if (before !== undefined && before !== rank) moved[id] = before - rank
    })
    prevRanksRef.current = current
    if (Object.keys(moved).length === 0) return
    setDeltas(prev => ({ ...prev, ...moved }))
    const t = setTimeout(() => setDeltas({}), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, showBonus])

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
        const delta = deltas[row.team.id] ?? 0
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
            <div className="text-center">
              <div className="text-xl font-black tabular-nums" style={{ color: rankColor }}>
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
              </div>
              {delta !== 0 && (
                <div className={`text-[10px] font-black tabular-nums leading-none mt-0.5 ${
                  delta > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                </div>
              )}
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

/**
 * One line above the board: where this group stands and how far the next one
 * is, so the standing is readable without leaving the tiles. Taps through to
 * the full scoreboard for the detail.
 */
export function BingoRankStrip({
  standings: { rows: rawRows, loading },
  teamId,
  onOpen,
}: {
  standings: BingoStandings
  teamId: string
  onOpen: () => void
}) {
  if (loading) return null

  const rows = sortBingoStandings([...rawRows], false)
  const index = rows.findIndex(r => r.team.id === teamId)
  if (index === -1) return null

  const me = rows[index]
  const ahead = index > 0 ? rows[index - 1] : null
  const behind = rows[index + 1] ?? null
  const gapUp = ahead ? ahead.points - me.points : 0
  const gapDown = behind ? me.points - behind.points : 0

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-left active:bg-white/10 transition-colors"
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-white text-sm font-black tabular-nums flex-shrink-0">
          {index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}`}
        </span>
        <span className="text-purple-300 text-[11px] font-black tabular-nums flex-shrink-0">{me.points} pts</span>
        <span className="text-gray-400 text-[11px] font-bold truncate">
          {ahead
            ? `${gapUp} behind ${ahead.team.name}`
            : behind
              ? `leading by ${gapDown}`
              : ''}
        </span>
      </div>
      <span className="text-gray-500 text-lg font-black leading-none flex-shrink-0">›</span>
    </button>
  )
}
