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
   * Join an existing team (created by admin) by teamId + password.
   * Admin creates teams in advance; participants pick from the list and enter the password.
   */
  const joinTeamById = async (teamId: string, password: string): Promise<BingoTeam> => {
    const trimmedPwd = password.trim()

    const { data: found, error } = await supabase
      .from('bingo_teams')
      .select('*')
      .eq('id', teamId)
      .single()
    if (error || !found) throw new Error('Group not found.')
    if (!found.password) throw new Error('This group has not been set up yet. Ask your facilitator.')
    if (found.password !== trimmedPwd) throw new Error('Wrong password for this group.')

    localStorage.setItem(TEAM_ID_KEY, found.id)
    localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(found))
    setTeam(found)
    return found
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
    joinTeamById,
    leaveTeam,
  }
}
