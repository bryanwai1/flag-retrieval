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

  const createTeam = useCallback(async (name: string): Promise<{ team: Team; password: string }> => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('NAME_REQUIRED')
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .ilike('name', trimmed)
      .maybeSingle()
    if (existing) throw new Error('TRIBE_NAME_TAKEN')
    const password = String(Math.floor(1000 + Math.random() * 9000))
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: trimmed, password })
      .select()
      .single()
    if (error || !data) {
      await fetchTeams()
      throw error ?? new Error('Insert failed')
    }
    await fetchTeams()
    return { team: data, password }
  }, [fetchTeams])

  const renameTeam = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setTeams(prev => prev.map(t => t.id === id ? { ...t, name: trimmed } : t))
    const { data, error } = await supabase.from('teams').update({ name: trimmed }).eq('id', id).select()
    if (error || !data || data.length === 0) {
      await fetchTeams()
      if (error) alert(`Rename failed: ${error.message}`)
    } else {
      await fetchTeams()
    }
  }, [fetchTeams])

  // Seed 17 default tribes ("Group 1" .. "Group 17") with random 4-digit codes.
  // Each name that already exists is skipped so this is safe to call against a
  // partially-populated list. Returns the number of tribes actually inserted.
  const seedDefaultTeams = useCallback(async (): Promise<number> => {
    const { data: existing } = await supabase.from('teams').select('name')
    const taken = new Set((existing ?? []).map(r => r.name.trim().toLowerCase()))
    const rows = Array.from({ length: 17 }, (_, i) => ({
      name: `Group ${i + 1}`,
      password: String(Math.floor(1000 + Math.random() * 9000)),
    })).filter(r => !taken.has(r.name.toLowerCase()))
    if (rows.length === 0) return 0
    const { error } = await supabase.from('teams').insert(rows)
    if (error) {
      alert(`Failed to seed default tribes: ${error.message}`)
      return 0
    }
    await fetchTeams()
    return rows.length
  }, [fetchTeams])

  const deleteTeam = useCallback(async (id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id))
    await supabase.from('team_members').delete().eq('team_id', id)
    await supabase.from('team_scans').delete().eq('team_id', id)
    const { data, error } = await supabase.from('teams').delete().eq('id', id).select()
    if (error || !data || data.length === 0) {
      await fetchTeams()
      alert(error ? `Delete failed: ${error.message}` : 'Delete failed — ensure anon DELETE policy exists on the "teams" table in Supabase.')
    } else {
      await fetchTeams()
    }
  }, [fetchTeams])

  return { teams, loading, refetch: fetchTeams, createTeam, renameTeam, deleteTeam, seedDefaultTeams }
}
