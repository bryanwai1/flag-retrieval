import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { BingoScan } from '../types/database'

export function useBingoScans() {
  const recordScan = useCallback(async (teamId: string, taskId: string): Promise<BingoScan | null> => {
    const { data: existing } = await supabase
      .from('bingo_scans')
      .select('*')
      .eq('team_id', teamId)
      .eq('task_id', taskId)
      .single()
    if (existing) return existing

    const { data, error } = await supabase
      .from('bingo_scans')
      .insert({ team_id: teamId, task_id: taskId })
      .select()
      .single()
    if (error) throw error
    return data
  }, [])

  const toggleComplete = useCallback(async (scanId: string, completed: boolean) => {
    const { error } = await supabase
      .from('bingo_scans')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', scanId)
    if (error) throw error
  }, [])

  return { recordScan, toggleComplete }
}
