import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchBoardTasks } from '../lib/boardCards'
import { computeBingoStandings, type BingoStandingRow } from '../lib/bingoStandings'
import type { BingoTask, BingoTeam, BingoScan, BingoDuel } from '../types/database'

export type BingoStandings = { rows: BingoStandingRow[]; loading: boolean }

/**
 * Everything one board's standings need, kept live. The board holds a single
 * instance and hands it to both the rank strip and the full scoreboard, so
 * switching tabs costs no fetch. Pass enabled=false (scoreboard switched off
 * for this board) to load nothing at all.
 */
export function useBingoStandings(sectionId: string, enabled = true): BingoStandings {
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [gridTasks, setGridTasks] = useState<BingoTask[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [duels, setDuels] = useState<BingoDuel[]>([])
  const [loading, setLoading] = useState(true)
  // Channels are named per mount so two of these can never collide.
  const channelIdRef = useRef(Math.random().toString(36).slice(2, 8))

  // Scans carry no section_id, so they're fetched by this section's team ids.
  const loadScans = async (teamIds: string[]) => {
    if (teamIds.length === 0) { setScans([]); return }
    const { data } = await supabase.from('bingo_scans').select('*').in('team_id', teamIds)
    if (data) setScans(data)
  }

  useEffect(() => {
    if (!enabled) return
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
  }, [sectionId, enabled])

  // Live updates. bingo_scans can't be server-filtered by a list of teams, so
  // any scan change triggers a refetch scoped to this section's teams.
  const teamIdsKey = teams.map(t => t.id).join(',')
  useEffect(() => {
    const teamIds = enabled && teamIdsKey ? teamIdsKey.split(',') : []
    if (teamIds.length === 0) return
    const channel = supabase
      .channel(`bingo-standings-${sectionId}-${channelIdRef.current}`)
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
  }, [sectionId, teamIdsKey, enabled])

  // iOS Safari kills the socket when the phone locks, so poll as a fallback —
  // the same self-healing the board itself relies on.
  useEffect(() => {
    const teamIds = enabled && teamIdsKey ? teamIdsKey.split(',') : []
    if (teamIds.length === 0) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadScans(teamIds)
    }, 8000)
    return () => clearInterval(id)
  }, [teamIdsKey, enabled])

  const rows = useMemo(
    () => computeBingoStandings({ teams, gridTasks, scans, duels }),
    [teams, gridTasks, scans, duels],
  )

  return { rows, loading }
}
