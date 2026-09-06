/**
 * AI-infused Bingo — the fusion layer between Bingo Dash and AI Team Building.
 *
 * The demo at /bingo-dash/sample-ai is the ordinary sample board with three of
 * its tiles swapped for real AITB missions, played inline on the tile: the same
 * roulette/card/animal module, the same steps, the same speed-bonus ladder.
 *
 * Two deliberate constraints:
 *
 *  1. The swap is CLIENT-SIDE ONLY. Nothing here writes to Supabase, so the live
 *     board (shared with real events and the plain sample) keeps its own cards.
 *  2. Points are scaled into Bingo's economy — see AITB_TILE_* below.
 */
import { AITB_ACTIVITIES, AITB_BONUS_MULT, AITB_COMPLETE, aitbSpeedBonus, type AitbActivity } from './aitbActivities'
import type { BingoTask } from '../types/database'

/** Tiles carrying this title are the ones handed over to AITB, in board order. */
export const AITB_SWAP_TITLE = 'Longest Breathe'

/** Roulette Jingle & Dance Off, Random Card Cinematic, Found Object Animals. */
const AITB_SWAP_IDS = [5, 6, 9]

const AITB_CATEGORY = 'AI Team Building'

/* ---------- Scoring ----------
   AITB's own ladder pays up to ~2,350 (Normal) / ~2,900 (Hard) per mission while
   a Bingo tile is worth 100-250, so playing it unscaled would make these three
   tiles the only ones that matter. Every award below is the AITB award divided
   down by a fixed factor: the shape of the game is untouched — check in, tick
   steps, finish fast — but a perfect mission lands at ~330 (Normal) / 400 (Hard).
   That is the best tile on the board, next to a 250-point Physical tile, rather
   than a board-winning tile.                                                   */
export const AITB_TILE_SCAN = 20
export const AITB_TILE_STEP = 20
const COMPLETE_SCALE = 0.2 // 350 → 70 (Normal), 500 → 100 (Hard)
export const AITB_BONUS_SCALE = 0.1 // 1400 → 140 (Normal), 1800 → 180 (Hard)

export function aitbTileCompleteAward(activity: AitbActivity): number {
  return Math.round(AITB_COMPLETE[activity.difficulty] * COMPLETE_SCALE)
}

export function aitbTileSpeedBonus(elapsedMs: number, activity: AitbActivity): number {
  return Math.round(aitbSpeedBonus(elapsedMs, activity) * AITB_BONUS_SCALE)
}

/** Best case: check in, tick every step, finish inside the first milestone. */
export function aitbTileMaxPoints(activity: AitbActivity): number {
  return AITB_TILE_SCAN
    + activity.steps.length * AITB_TILE_STEP
    + aitbTileCompleteAward(activity)
    + aitbTileSpeedBonus(0, activity)
}

/**
 * What a mission pays a team that finished it but did not race: everything
 * except the speed bonus, which lands on the slowest paying milestone. The demo
 * scoreboard uses it for the teams you aren't playing, so their totals read like
 * a real board instead of everyone acing every mission.
 */
export function aitbTileParPoints(activity: AitbActivity): number {
  const slowest = activity.bonusTiers[activity.bonusTiers.length - 1]
  return AITB_TILE_SCAN
    + activity.steps.length * AITB_TILE_STEP
    + aitbTileCompleteAward(activity)
    + Math.round(slowest.pts * AITB_BONUS_MULT[activity.difficulty] * AITB_BONUS_SCALE)
}

/** One team's run at an AI tile. Local to the demo — never persisted. */
export type AitbTileRun = {
  /** epoch ms of check-in; the timer and the whole bonus ladder run off this. */
  startedAt: number
  /** indices of the steps ticked so far */
  steps: number[]
  /** the module's result (spun genre/topic, dealt cards, drawn animals) */
  words: string[]
  completedAt: number | null
  /** speed bonus banked at completion — frozen so it stops decaying */
  bonus: number
}

export function newAitbRun(): AitbTileRun {
  return { startedAt: Date.now(), steps: [], words: [], completedAt: null, bonus: 0 }
}

export type AitbPointLine = { label: string; points: number }

/** Itemised breakdown, in the order it was earned — drives the points popup. */
export function aitbTileBreakdown(run: AitbTileRun, activity: AitbActivity): AitbPointLine[] {
  const lines: AitbPointLine[] = [{ label: '🚀 Mission check-in', points: AITB_TILE_SCAN }]
  if (run.steps.length > 0) {
    lines.push({
      label: `✅ Steps completed (${run.steps.length}/${activity.steps.length})`,
      points: run.steps.length * AITB_TILE_STEP,
    })
  }
  if (run.completedAt) {
    lines.push({ label: `🏁 Mission complete (${activity.difficulty})`, points: aitbTileCompleteAward(activity) })
    lines.push({ label: '⚡ Speed bonus', points: run.bonus })
  }
  return lines
}

export function aitbTilePoints(run: AitbTileRun, activity: AitbActivity): number {
  return aitbTileBreakdown(run, activity).reduce((sum, l) => sum + l.points, 0)
}

/* ---------- The swap ---------- */

/** A board tile standing in for an AITB mission. */
export type AitbBingoTask = BingoTask & { aitb_id?: number }

export function aitbForTask(task: BingoTask): AitbActivity | null {
  const id = (task as AitbBingoTask).aitb_id
  if (!id) return null
  return AITB_ACTIVITIES.find(a => a.id === id) ?? null
}

/**
 * Hand the board's `Longest Breathe` tiles to AITB, in board order. Slot and id
 * are preserved so the 5×5 layout and every bingo line stay exactly as they were
 * — only the face, the colour, the value and the way the tile is played change.
 * Boards without those tiles come back untouched.
 */
export function swapAitbTiles(tasks: BingoTask[]): BingoTask[] {
  let next = 0
  return tasks.map(task => {
    if (task.title !== AITB_SWAP_TITLE || next >= AITB_SWAP_IDS.length) return task
    const activity = AITB_ACTIVITIES.find(a => a.id === AITB_SWAP_IDS[next])
    next++
    if (!activity) return task
    const swapped: AitbBingoTask = {
      ...task,
      title: activity.name,
      color: AITB_CATEGORY,
      hex_code: activity.color,
      category: AITB_CATEGORY,
      points: aitbTileMaxPoints(activity),
      task_type: 'standard',
      // The mission overlay runs its own flow; none of the stock tile machinery
      // (answer rows, photo upload, marshal gate, contest duel) applies.
      answer_question: null,
      answer_text: null,
      require_marshal: false,
      is_contest: false,
      aitb_id: activity.id,
    }
    return swapped
  })
}
