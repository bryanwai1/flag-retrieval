// Bridge: an imported bingo card ⇄ its AI Team Building activity.
//
// importAitbCards() creates one bingo_tasks row per AITB activity, filed under
// the "AI Team Building" category and titled with the activity's exact name.
// That name is the join key — no extra column, so a board that was imported
// before this file existed lights up with the rich brief too.
//
// Matching is deliberately loose on whitespace/case only: a facilitator who
// renames a card to "Nerf Prompt Cups " keeps the brief, but one who renames it
// to something else falls back to the plain instruction pages, which is the
// honest outcome — it is no longer that activity.

import { AITB_ACTIVITIES, type AitbActivity } from './aitbActivities'
import { AITB_CATEGORY_NAME } from './importAitbCards'
import type { BingoTask } from '../types/database'

const byName = new Map(AITB_ACTIVITIES.map(a => [a.name.trim().toLowerCase(), a]))

/** The AITB activity a bingo card came from, or null if it isn't one. */
export function aitbActivityForTask(
  task: Pick<BingoTask, 'title' | 'category' | 'color'> | null | undefined,
): AitbActivity | null {
  if (!task) return null
  // `category` is the library grouping and `color` is the label printed on the
  // tile — the import sets both to the category name, and the admin's card
  // editor writes one or the other depending on where it was edited from.
  const tagged = [task.category, task.color]
    .some(v => (v ?? '').trim().toLowerCase() === AITB_CATEGORY_NAME.toLowerCase())
  if (!tagged) return null
  return byName.get((task.title ?? '').trim().toLowerCase()) ?? null
}
