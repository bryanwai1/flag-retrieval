import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Team } from '../types/database'

const TEAM_ID_KEY = 'flag-retrieval-team-id'
const MEMBER_NAME_KEY = 'flag-retrieval-member-name'
const MEMBER_ID_KEY = 'flag-retrieval-member-id'
const TEAM_DATA_KEY = 'flag-retrieval-team-data'

export interface TribeResult {
  id: string
  name: string
  memberCount: number
}

export function useCurrentTeam() {
  const [team, setTeam] = useState<Team | null>(null)
  const [memberName, setMemberName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const teamId = localStorage.getItem(TEAM_ID_KEY)
    const savedName = localStorage.getItem(MEMBER_NAME_KEY)
    if (savedName) setMemberName(savedName)
    if (!teamId) { setLoading(false); return }

    // Use cached team data immediately so the page renders without waiting for DB
    const cached = localStorage.getItem(TEAM_DATA_KEY)
    if (cached) {
      try {
        setTeam(JSON.parse(cached))
        setLoading(false)
      } catch { /* ignore */ }
    }

    // Validate in background — update cache if changed, clear if team deleted
    supabase
      .from('teams')
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

  const searchTribes = async (query: string): Promise<TribeResult[]> => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, team_members(id)')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(20)
    return (data || [])
      .map((t: { id: string; name: string; team_members: { id: string }[] }) => ({
        id: t.id,
        name: t.name,
        memberCount: t.team_members?.length ?? 0,
      }))
      .filter((t) => t.memberCount < 20)
  }

  const createTribe = async (tribeName: string, name: string, password: string): Promise<Team> => {
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .ilike('name', tribeName)
      .maybeSingle()
    if (existing) throw new Error('TRIBE_NAME_TAKEN')

    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert({ name: tribeName, password })
      .select()
      .single()
    if (error) throw error

    const { data: memberData } = await supabase.from('team_members').insert({
      team_id: newTeam.id,
      name,
      is_creator: true,
    }).select().single()

    localStorage.setItem(TEAM_ID_KEY, newTeam.id)
    localStorage.setItem(MEMBER_NAME_KEY, name)
    localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(newTeam))
    if (memberData) localStorage.setItem(MEMBER_ID_KEY, memberData.id)
    setTeam(newTeam)
    setMemberName(name)
    return newTeam
  }

  const joinTribe = async (teamId: string, name: string, password: string): Promise<Team> => {
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()
    if (!teamData) throw new Error('TRIBE_NOT_FOUND')
    if (teamData.password && teamData.password !== password) throw new Error('WRONG_PASSWORD')

    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
    if ((count ?? 0) >= 20) throw new Error('TRIBE_FULL')

    const { data: memberData } = await supabase.from('team_members').insert({
      team_id: teamId,
      name,
      is_creator: false,
    }).select().single()

    localStorage.setItem(TEAM_ID_KEY, teamId)
    localStorage.setItem(MEMBER_NAME_KEY, name)
    localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(teamData))
    if (memberData) localStorage.setItem(MEMBER_ID_KEY, memberData.id)
    setTeam(teamData)
    setMemberName(name)
    return teamData
  }

  const leaveTribe = async () => {
    const memberId = localStorage.getItem(MEMBER_ID_KEY)
    if (memberId) {
      await supabase.from('team_members').delete().eq('id', memberId)
    }
    localStorage.removeItem(TEAM_ID_KEY)
    localStorage.removeItem(MEMBER_NAME_KEY)
    localStorage.removeItem(MEMBER_ID_KEY)
    localStorage.removeItem(TEAM_DATA_KEY)
    setTeam(null)
    setMemberName('')
  }

  return {
    team,
    memberName,
    loading,
    isRegistered: !!team && !!memberName,
    createTribe,
    joinTribe,
    searchTribes,
    leaveTribe,
  }
}
