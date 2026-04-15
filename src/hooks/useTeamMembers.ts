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
    const { data, error } = await supabase.from('team_members').update({ name: trimmed }).eq('id', id).select()
    if (error || !data || data.length === 0) {
      await fetchMembers()
      if (error) alert(`Rename failed: ${error.message}`)
    } else {
      await fetchMembers()
    }
  }, [fetchMembers])

  const removeMember = useCallback(async (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id))
    const { data, error } = await supabase.from('team_members').delete().eq('id', id).select()
    if (error || !data || data.length === 0) {
      await fetchMembers()
      if (error) alert(`Remove failed: ${error.message}`)
    } else {
      await fetchMembers()
    }
  }, [fetchMembers])

  const moveMember = useCallback(async (id: string, newTeamId: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, team_id: newTeamId } : m))
    const { data, error } = await supabase.from('team_members').update({ team_id: newTeamId }).eq('id', id).select()
    if (error || !data || data.length === 0) {
      await fetchMembers()
      if (error) alert(`Move failed: ${error.message}`)
    } else {
      await fetchMembers()
    }
  }, [fetchMembers])

  return { members, loading, renameMember, removeMember, moveMember }
}
