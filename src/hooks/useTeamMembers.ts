import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface TeamMember {
  id: string
  team_id: string
  name: string
  is_creator: boolean
  created_at: string
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setMembers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMembers()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('team-members-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, fetchMembers)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchMembers])

  const renameMember = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name: trimmed } : m))
    await supabase.from('team_members').update({ name: trimmed }).eq('id', id)
  }, [])

  const removeMember = useCallback(async (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id))
    await supabase.from('team_members').delete().eq('id', id)
  }, [])

  const moveMember = useCallback(async (id: string, newTeamId: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, team_id: newTeamId } : m))
    await supabase.from('team_members').update({ team_id: newTeamId }).eq('id', id)
  }, [])

  return { members, loading, renameMember, removeMember, moveMember }
}
