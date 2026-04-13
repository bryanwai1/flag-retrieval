import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface LeaderboardEntry {
  teamId: string
  teamName: string
  flagsCompleted: number
  pointsGathered: number
  lastCompletedAt: string | null
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const { data } = await supabase
      .from('team_scans')
      .select('team_id, completed_at, teams(name), tasks(points)')
      .eq('completed', true)

    const map = new Map<string, LeaderboardEntry>()
    for (const scan of data ?? []) {
      const team = scan.teams as unknown as { name: string } | null
      const task = scan.tasks as unknown as { points: number } | null
      if (!team) continue
      const prev = map.get(scan.team_id) ?? {
        teamId: scan.team_id,
        teamName: team.name,
        flagsCompleted: 0,
        pointsGathered: 0,
        lastCompletedAt: null,
      }
      prev.flagsCompleted += 1
      prev.pointsGathered += task?.points ?? 0
      // Track the latest completed_at across all scans for this team
      if (scan.completed_at && (!prev.lastCompletedAt || scan.completed_at > prev.lastCompletedAt)) {
        prev.lastCompletedAt = scan.completed_at
      }
      map.set(scan.team_id, prev)
    }
    setEntries(Array.from(map.values()))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeaderboard()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_scans' }, fetchLeaderboard)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchLeaderboard])

  const byFlags = [...entries].sort((a, b) => b.flagsCompleted - a.flagsCompleted || a.teamName.localeCompare(b.teamName))
  const byPoints = [...entries].sort((a, b) => b.pointsGathered - a.pointsGathered || a.teamName.localeCompare(b.teamName))

  return { byFlags, byPoints, loading }
}
