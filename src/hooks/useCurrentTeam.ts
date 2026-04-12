import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Team } from '../types/database'

const TEAM_ID_KEY = 'flag-retrieval-team-id'

export function useCurrentTeam() {
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const teamId = localStorage.getItem(TEAM_ID_KEY)
    if (!teamId) {
      setLoading(false)
      return
    }
    supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()
      .then(({ data }) => {
        if (data) setTeam(data)
        else localStorage.removeItem(TEAM_ID_KEY)
        setLoading(false)
      })
  }, [])

  const register = async (name: string): Promise<Team> => {
    const { data: existing } = await supabase
      .from('teams')
      .select('*')
      .eq('name', name)
      .single()
    if (existing) {
      localStorage.setItem(TEAM_ID_KEY, existing.id)
      setTeam(existing)
      return existing
    }
    const { data, error } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single()
    if (error) throw error
    localStorage.setItem(TEAM_ID_KEY, data.id)
    setTeam(data)
    return data
  }

  return { team, loading, isRegistered: !!team, register }
}
