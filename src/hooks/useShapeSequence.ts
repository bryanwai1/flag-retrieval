import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export type Shape = 'circle' | 'square' | 'star' | 'x'

export interface ShapeRound {
  id: string
  round_number: number
  circle_count: number
  shapes: Shape[]
  is_active: boolean
  results_visible: boolean
  created_at: string
}

export interface ShapeResult {
  id: string
  round_id: string
  team_name: string
  completion_time: number // seconds
  created_at: string
}

export function useShapeSequence() {
  const [rounds, setRounds] = useState<ShapeRound[]>([])
  const [results, setResults] = useState<ShapeResult[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRounds = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('shape_rounds')
      .select('*')
      .order('round_number')
    if (data) setRounds(data)
  }, [])

  const fetchResults = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const { data } = await supabase
      .from('shape_results')
      .select('*')
      .order('completion_time')
    if (data) setResults(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRounds()
    fetchResults()

    const channel = supabase
      .channel('shape-sequence-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shape_rounds' }, fetchRounds)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shape_results' }, fetchResults)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchRounds, fetchResults])

  const upsertRound = async (
    roundNumber: number,
    updates: Partial<Omit<ShapeRound, 'id' | 'created_at'>>
  ) => {
    const existing = rounds.find(r => r.round_number === roundNumber)
    if (existing) {
      await supabase.from('shape_rounds').update(updates).eq('id', existing.id)
    } else {
      await supabase.from('shape_rounds').insert({
        round_number: roundNumber,
        circle_count: 20,
        shapes: [],
        is_active: false,
        results_visible: false,
        ...updates,
      })
    }
    await fetchRounds()
  }

  const setActiveRound = async (roundNumber: number) => {
    for (const r of rounds) {
      await supabase
        .from('shape_rounds')
        .update({ is_active: r.round_number === roundNumber })
        .eq('id', r.id)
    }
    await fetchRounds()
  }

  const toggleResultsVisible = async (roundId: string, visible: boolean) => {
    await supabase.from('shape_rounds').update({ results_visible: visible }).eq('id', roundId)
    await fetchRounds()
  }

  const addResult = async (roundId: string, teamName: string, completionTime: number) => {
    await supabase.from('shape_results').insert({
      round_id: roundId,
      team_name: teamName,
      completion_time: completionTime,
    })
    await fetchResults()
  }

  const updateResult = async (resultId: string, completionTime: number) => {
    await supabase.from('shape_results').update({ completion_time: completionTime }).eq('id', resultId)
    await fetchResults()
  }

  const deleteResult = async (resultId: string) => {
    await supabase.from('shape_results').delete().eq('id', resultId)
    await fetchResults()
  }

  return {
    rounds,
    results,
    loading,
    upsertRound,
    setActiveRound,
    toggleResultsVisible,
    addResult,
    updateResult,
    deleteResult,
    refetch: fetchRounds,
  }
}
