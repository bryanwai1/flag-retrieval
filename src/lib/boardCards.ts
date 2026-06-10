import { supabase } from './supabase'
import type { BingoBoardCard, BingoTask } from '../types/database'

// Fetch the cards placed on a board, ordered by slot. Placements live in
// bingo_board_cards (cards are universal — one task can sit on many boards),
// so the returned tasks carry sort_order = slot and in_grid = true to stay
// compatible with the 5x5 layout helpers (buildBingoSlots etc.).
export async function fetchBoardTasks(sectionId: string): Promise<BingoTask[]> {
  const { data: placements } = await supabase
    .from('bingo_board_cards')
    .select('*')
    .eq('section_id', sectionId)
    .order('slot')
  if (!placements || placements.length === 0) return []
  const { data: tasks } = await supabase
    .from('bingo_tasks')
    .select('*')
    .in('id', placements.map(p => p.task_id))
  if (!tasks) return []
  const byId = new Map<string, BingoTask>(tasks.map(t => [t.id, t]))
  return (placements as BingoBoardCard[])
    .map(p => {
      const t = byId.get(p.task_id)
      return t ? { ...t, sort_order: p.slot, in_grid: true } : null
    })
    .filter((t): t is BingoTask => t !== null)
    .slice(0, 25)
}
