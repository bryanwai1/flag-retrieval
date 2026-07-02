import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TeamScan } from '../types/database'

// Scans have no owner_id — tenancy flows through the team. Pass the scoped
// team-id list (from useTeams) so the fetch and "reset all" only ever touch
// this tenant's rows; omit for the legacy unscoped behaviour (participant page
// only calls recordScan/toggleComplete, which are id-targeted anyway).
export function useTeamScans(teamIds?: string[]) {
  const [scans, setScans] = useState<TeamScan[]>([])
  const [loading, setLoading] = useState(true)

  const teamKey = teamIds ? teamIds.join(',') : null

  const fetchScans = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    try {
      let query = supabase.from('team_scans').select('*')
      if (teamKey !== null) {
        const ids = teamKey ? teamKey.split(',') : []
        if (ids.length === 0) { setScans([]); setLoading(false); return }
        query = query.in('team_id', ids)
      }
      const { data } = await query.order('scanned_at', { ascending: true })
      if (data) setScans(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [teamKey])

  useEffect(() => {
    fetchScans()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('team-scans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_scans' }, () => {
        fetchScans()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchScans])

  const toggleComplete = async (scanId: string, completed: boolean) => {
    const { error } = await supabase
      .from('team_scans')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', scanId)
    if (error) throw error
  }

  const resetTeamScans = async (teamId: string) => {
    const { error } = await supabase.from('team_scans').delete().eq('team_id', teamId)
    if (error) throw error
  }

  // Tenant-safe: when a team-id scope was provided, only those teams' scans
  // are deleted — never another account's live event.
  const resetAllScans = async () => {
    if (teamKey !== null) {
      const ids = teamKey ? teamKey.split(',') : []
      if (ids.length === 0) return
      const { error } = await supabase.from('team_scans').delete().in('team_id', ids)
      if (error) throw error
      return
    }
    const { error } = await supabase.from('team_scans').delete().neq('team_id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  }

  const recordScan = async (teamId: string, taskId: string) => {
    const { data: existing } = await supabase
      .from('team_scans')
      .select('*')
      .eq('team_id', teamId)
      .eq('task_id', taskId)
      .single()
    if (existing) return existing
    const { data, error } = await supabase
      .from('team_scans')
      .insert({ team_id: teamId, task_id: taskId })
      .select()
      .single()
    if (error) throw error
    return data
  }

  return { scans, loading, toggleComplete, recordScan, resetTeamScans, resetAllScans, refetch: fetchScans }
}
