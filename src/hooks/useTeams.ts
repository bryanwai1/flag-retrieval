import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Team } from '../types/database'

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true })
      if (data) setTeams(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTeams()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('teams-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchTeams])

  return { teams, loading, refetch: fetchTeams }
}
