import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { BingoTeam } from '../types/database'

const TEAM_ID_KEY   = 'bingo-dash-team-id'
const TEAM_DATA_KEY = 'bingo-dash-team-data'

export function useBingoDashTeam() {
  const [team, setTeam] = useState<BingoTeam | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }

    const teamId = localStorage.getItem(TEAM_ID_KEY)
    if (!teamId) { setLoading(false); return }

    // Use cached data immediately
    const cached = localStorage.getItem(TEAM_DATA_KEY)
    if (cached) {
      try { setTeam(JSON.parse(cached)); setLoading(false) } catch { /* ignore */ }
    }

    // Validate in background
    supabase
      .from('bingo_teams')
      .select('*')
      .eq('id', teamId)
      .single()
      .then(({ data }) => {
        if (data) {
          setTeam(data)
          localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(data))
        } else {
          localStorage.removeItem(TEAM_ID_KEY)
          localStorage.removeItem(TEAM_DATA_KEY)
          setTeam(null)
        }
        if (!cached) setLoading(false)
      })
  }, [])

  /**
   * Register with team name + password.
   * Looks up an existing team by name + password (case-insensitive name match).
   * Creates a new team if none found.
   */
  const registerTeam = async (teamName: string, password: string): Promise<BingoTeam> => {
    const trimmedName = teamName.trim()
    const trimmedPwd  = password.trim()
    if (!trimmedName) throw new Error('Team name cannot be empty')

    // Resolve the section this registration belongs to from global settings.
    const { data: settings } = await supabase
      .from('bingo_settings').select('active_section_id').eq('id', 'main').single()
    const sectionId = settings?.active_section_id
    if (!sectionId) throw new Error('No active section — ask the admin to pick one.')

    // Try to find existing team by name within the active section.
    const { data: existing } = await supabase
      .from('bingo_teams')
      .select('*')
      .eq('section_id', sectionId)
      .ilike('name', trimmedName)
      .maybeSingle()

    let result: BingoTeam
    if (existing) {
      // Team exists — verify password
      if (existing.password !== trimmedPwd) throw new Error('Wrong password for this team name.')
      result = existing
    } else {
      const { data: created, error } = await supabase
        .from('bingo_teams')
        .insert({ name: trimmedName, password: trimmedPwd, section_id: sectionId })
        .select()
        .single()
      if (error) throw error
      result = created
    }

    localStorage.setItem(TEAM_ID_KEY, result.id)
    localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(result))
    setTeam(result)
    return result
  }

  const leaveTeam = () => {
    localStorage.removeItem(TEAM_ID_KEY)
    localStorage.removeItem(TEAM_DATA_KEY)
    setTeam(null)
  }

  return {
    team,
    loading,
    isRegistered: !!team,
    registerTeam,
    leaveTeam,
  }
}
