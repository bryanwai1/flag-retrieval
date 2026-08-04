import { supabase } from './supabase'
import { AITB_ACTIVITIES } from './aitbActivities'
import type { BingoTask } from '../types/database'

// Import the AI Team Building activities into a board's Cards Library as a
// "Special" challenge section, so they can be dragged onto the 5×5 grid like any
// other card.
//
// Idempotent by NAME at every level — re-running adopts whatever already exists
// and only creates what's missing, so a facilitator can hit the button twice
// without ending up with duplicate sections, categories or cards.
//
// Speed Edit Showdown comes in with contending already switched on, because that
// is the one activity Bryan specced as a head-to-head duel. The rest arrive as
// normal marshal-approved cards; flip any of them to contending later once their
// duel rules exist in lib/contestGames.ts.

export const SPECIAL_SECTION_NAME = 'Special'
export const AITB_CATEGORY_NAME = 'AI Team Building'
const SPEED_EDIT_ACTIVITY_ID = 8

export type ImportResult = {
  createdCards: number
  skippedCards: number
  categoryName: string
  sectionName: string
}

export async function importAitbCards(
  gameSectionId: string,
  ownerValue: string | null,
): Promise<ImportResult> {
  // ── 1. "Special" challenge section ─────────────────────────────────────────
  const { data: existingCS } = await supabase
    .from('bingo_challenge_sections')
    .select('*')
    .eq('game_section_id', gameSectionId)
    .eq('name', SPECIAL_SECTION_NAME)
    .maybeSingle()

  let challengeSectionId = existingCS?.id ?? null
  if (!challengeSectionId) {
    const { data: allCS } = await supabase
      .from('bingo_challenge_sections').select('sort_order').eq('game_section_id', gameSectionId)
    const nextOrder = (allCS ?? []).reduce((m, cs) => Math.max(m, cs.sort_order), -1) + 1
    const { data, error } = await supabase.from('bingo_challenge_sections')
      .insert({ game_section_id: gameSectionId, name: SPECIAL_SECTION_NAME, sort_order: nextOrder })
      .select().single()
    if (error || !data) throw new Error(error?.message ?? 'Could not create the Special section')
    challengeSectionId = data.id
  }

  // ── 2. "AI Team Building" category inside it ───────────────────────────────
  const { data: existingCat } = await supabase
    .from('bingo_categories')
    .select('*')
    .eq('section_id', gameSectionId)
    .eq('name', AITB_CATEGORY_NAME)
    .maybeSingle()

  if (existingCat) {
    // Category may pre-date the section — make sure it is filed under Special.
    if (existingCat.challenge_section_id !== challengeSectionId) {
      await supabase.from('bingo_categories')
        .update({ challenge_section_id: challengeSectionId }).eq('id', existingCat.id)
    }
  } else {
    const { data: allCats } = await supabase
      .from('bingo_categories').select('sort_order').eq('section_id', gameSectionId)
    const nextOrder = (allCats ?? []).reduce((m, c) => Math.max(m, c.sort_order), -1) + 1
    const { error } = await supabase.from('bingo_categories').insert({
      section_id: gameSectionId,
      challenge_section_id: challengeSectionId,
      name: AITB_CATEGORY_NAME,
      sort_order: nextOrder,
    })
    if (error) throw new Error(error.message)
  }

  // ── 3. One card per activity ───────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('bingo_tasks').select('id, title').eq('section_id', gameSectionId)
  const existingTitles = new Set((existing ?? []).map(t => t.title))

  const { count } = await supabase
    .from('bingo_tasks').select('id', { count: 'exact', head: true }).eq('section_id', gameSectionId)
  let nextSort = Math.max(25, (count ?? 0) + 25)

  let createdCards = 0
  let skippedCards = 0

  for (const act of AITB_ACTIVITIES) {
    if (existingTitles.has(act.name)) { skippedCards++; continue }

    const isSpeedEdit = act.id === SPEED_EDIT_ACTIVITY_ID
    const { data: card, error } = await supabase.from('bingo_tasks').insert({
      section_id: gameSectionId,
      owner_id: ownerValue,
      title: act.name,
      // `color` is the label players read on the tile; `category` is the
      // library grouping. Both point at the same name here so the Special
      // cards read consistently on the board and in the admin.
      color: AITB_CATEGORY_NAME,
      hex_code: act.color,
      category: AITB_CATEGORY_NAME,
      points: 100,
      in_grid: false,
      sort_order: nextSort++,
      task_type: 'standard',
      require_marshal: true,
      completion_warning: `Show the marshal your ${act.outType.toLowerCase()} to complete this challenge.`,
      is_contest: isSpeedEdit,
      contest_game: 'speed-edit',
      contest_bonus: isSpeedEdit ? 200 : 0,
    }).select().single()

    if (error || !card) throw new Error(error?.message ?? `Could not create "${act.name}"`)

    // Instructions page — the activity's own steps, so the card is playable the
    // moment it lands on a board rather than being an empty title.
    const pointers: Record<string, string | null> = {}
    const icons: Record<string, string | null> = {}
    act.steps.slice(0, 6).forEach((step, i) => {
      pointers[`pointer_${i + 1}`] = step
      icons[`icon_${i + 1}`] = act.stepEmojis[i] ?? null
    })
    await supabase.from('bingo_task_pages').insert({
      task_id: (card as BingoTask).id,
      page_order: 0,
      ...pointers,
      ...icons,
    })

    createdCards++
  }

  return {
    createdCards,
    skippedCards,
    categoryName: AITB_CATEGORY_NAME,
    sectionName: SPECIAL_SECTION_NAME,
  }
}
