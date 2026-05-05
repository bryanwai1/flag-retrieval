import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export type Shape = 'circle' | 'square' | 'star' | 'x'
export type RoundMode = 'shapes' | 'numbers'

export interface ShapeRound {
  id: string
  round_number: number
  circle_count: number
  mode: RoundMode
  shapes: Shape[]
  numbers: number[]
  is_active: boolean
  results_visible: boolean
  accepting_submissions: boolean
  created_at: string
}

export interface ShapeResult {
  id: string
  round_id: string
  team_name: string
  completion_time: number // seconds
  has_penalty: boolean
  created_at: string
}

export interface ShapeFacilitator {
  id: string
  group_name: string
  facilitator_num: number | null
  created_at: string
}

export function useShapeSequence() {
  const [rounds, setRounds] = useState<ShapeRound[]>([])
  const [results, setResults] = useState<ShapeResult[]>([])
  const [facilitators, setFacilitators] = useState<ShapeFacilitator[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRounds = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('shape_rounds')
      .select('*')
      .order('round_number')
    if (data) {
      setRounds(data.map((r: ShapeRound) => ({
        ...r,
        mode: (r.mode === 'numbers' ? 'numbers' : 'shapes') as RoundMode,
        numbers: Array.isArray(r.numbers) ? r.numbers : [],
        shapes: Array.isArray(r.shapes) ? r.shapes : [],
      })))
    }
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

  const fetchFacilitators = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('shape_facilitators')
      .select('*')
      .order('created_at')
    if (data) setFacilitators(data)
  }, [])

  useEffect(() => {
    fetchRounds()
    fetchResults()
    fetchFacilitators()

    const channel = supabase
      .channel('shape-sequence-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shape_rounds' }, fetchRounds)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shape_results' }, fetchResults)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shape_facilitators' }, fetchFacilitators)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchRounds, fetchResults, fetchFacilitators])

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
        mode: 'shapes',
        shapes: [],
        numbers: [],
        is_active: false,
        results_visible: false,
        accepting_submissions: false,
        ...updates,
      })
    }
    await fetchRounds()
  }

  const setActiveRound = async (roundNumber: number) => {
    for (const r of rounds) {
      await supabase
        .from('shape_rounds')
        .update({
          is_active: r.round_number === roundNumber,
          accepting_submissions: false,
        })
        .eq('id', r.id)
    }
    await fetchRounds()
  }

  const endRound = async (roundId: string) => {
    await supabase
      .from('shape_rounds')
      .update({ is_active: false, accepting_submissions: true })
      .eq('id', roundId)
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

  const setResultPenalty = async (resultId: string, hasPenalty: boolean) => {
    await supabase.from('shape_results').update({ has_penalty: hasPenalty }).eq('id', resultId)
    await fetchResults()
  }

  const deleteResult = async (resultId: string) => {
    await supabase.from('shape_results').delete().eq('id', resultId)
    await fetchResults()
  }

  const clearRoundResults = async (roundId: string) => {
    await supabase.from('shape_results').delete().eq('round_id', roundId)
    await fetchResults()
  }

  const setAllResultsVisible = async (visible: boolean) => {
    for (const r of rounds) {
      await supabase.from('shape_rounds').update({ results_visible: visible }).eq('id', r.id)
    }
    await fetchRounds()
  }

  // Facilitator management
  const addFacilitator = async (groupName: string, facilitatorNum?: number): Promise<ShapeFacilitator | null> => {
    const { data, error } = await supabase
      .from('shape_facilitators')
      .insert({ group_name: groupName.trim(), facilitator_num: facilitatorNum ?? null })
      .select()
      .single()
    if (error) throw error
    await fetchFacilitators()
    return data
  }

  const renameFacilitator = async (id: string, newName: string) => {
    const { error } = await supabase
      .from('shape_facilitators')
      .update({ group_name: newName.trim() })
      .eq('id', id)
    if (error) throw error
    await fetchFacilitators()
  }

  const deleteFacilitator = async (id: string) => {
    await supabase.from('shape_facilitators').delete().eq('id', id)
    await fetchFacilitators()
  }

  return {
    rounds,
    results,
    facilitators,
    loading,
    upsertRound,
    setActiveRound,
    endRound,
    toggleResultsVisible,
    setAllResultsVisible,
    addResult,
    updateResult,
    setResultPenalty,
    deleteResult,
    clearRoundResults,
    addFacilitator,
    renameFacilitator,
    deleteFacilitator,
    refetch: fetchRounds,
  }
}
