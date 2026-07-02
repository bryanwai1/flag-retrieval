import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface TeamMember {
  id: string
  team_id: string
  name: string
  is_creator: boolean
  joined_at: string
}

// Members have no owner_id — tenancy flows through the team. Pass the scoped
// team-id list (from useTeams) to only load this tenant's members; omit for the
// legacy fetch-everything behaviour (anonymous pages).
export function useTeamMembers(teamIds?: string[]) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  // Depend on the joined key, not the array identity — callers rebuild the
  // array every render.
  const teamKey = teamIds ? teamIds.join(',') : null

  const fetchMembers = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    let query = supabase.from('team_members').select('*')
    if (teamKey !== null) {
      const ids = teamKey ? teamKey.split(',') : []
      if (ids.length === 0) { setMembers([]); setLoading(false); return }
      query = query.in('team_id', ids)
    }
    const { data, error } = await query.order('joined_at', { ascending: true })
    if (error) console.error('useTeamMembers fetch failed:', error)
    if (data) setMembers(data)
    setLoading(false)
  }, [teamKey])

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
