import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TeamScan } from '../types/database'

export function useTeamScans() {
  const [scans, setScans] = useState<TeamScan[]>([])
  const [loading, setLoading] = useState(true)

  const fetchScans = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('team_scans')
        .select('*')
        .order('scanned_at', { ascending: true })
      if (data) setScans(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

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

  const resetAllScans = async () => {
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
