// ── Award slide sequence + tier helpers ─────────────────────────────────────
//
// Slide ids:
//   · "intro", "holding" — singletons (unique)
//   · "<prizeKind>:<n>"  — prize slide where n is a stable, never-reused
//                          positional counter within the kind. Removing a
//                          prize slide leaves surrounding ids untouched.
//
// Display rank in a tier ("Consolation #1, #2, …") is computed from the order
// a slide appears in `slide_order`, NOT from the numeric suffix.
//
// Team assignment is canonical: all `first` slides (in display order) take
// team ranks 1..first_count, then `second` slides take the next block, etc.
// Reordering visible slides does not change who wins what.

export type PrizeKind = 'consolation' | 'third' | 'second' | 'first'
export type AwardSlideKind = 'intro' | 'holding' | PrizeKind

export type AwardSlideId = string

export interface AwardSlideDescriptor {
  id: AwardSlideId
  kind: AwardSlideKind
  /** 1-based position within kind, as displayed. null for intro/holding. */
  rank: number | null
  /** 1-based overall team rank assigned canonically. null for intro/holding. */
  teamRank: number | null
}

export interface PrizeCounts {
  consolation_count: number
  third_count: number
  second_count: number
  first_count: number
}

export const CANONICAL_KINDS: PrizeKind[] = ['first', 'second', 'third', 'consolation']

export const SLIDE_LABELS: Record<AwardSlideKind, { label: string; emoji: string; accent: string }> = {
  intro:       { label: 'Animated opener',  emoji: '✨', accent: '#fde68a' },
  holding:     { label: 'Holding slide',    emoji: '⏳', accent: '#fcd34d' },
  first:       { label: 'Grand Champion',   emoji: '🏆', accent: '#fde047' },
  second:      { label: 'First Runner-Up',  emoji: '🥈', accent: '#e5e7eb' },
  third:       { label: 'Second Runner-Up', emoji: '🥉', accent: '#f59e0b' },
  consolation: { label: 'Honorable Mention',emoji: '🎖', accent: '#c4b5fd' },
}

export function isPrizeKind(kind: string): kind is PrizeKind {
  return kind === 'consolation' || kind === 'third' || kind === 'second' || kind === 'first'
}

/** Parse a slide id into its kind + numeric suffix (suffix null for singletons). */
export function parseSlideId(id: AwardSlideId): { kind: AwardSlideKind; index: number | null } {
  if (id === 'intro') return { kind: 'intro', index: null }
  if (id === 'holding') return { kind: 'holding', index: null }
  const [kind, idxStr] = id.split(':') as [string, string]
  if (!isPrizeKind(kind)) throw new Error(`Unknown slide id: ${id}`)
  return { kind, index: parseInt(idxStr, 10) }
}

/** Count how many slides of each prize kind appear in slide_order. */
export function countsFromOrder(order: AwardSlideId[]): PrizeCounts {
  const c = { consolation_count: 0, third_count: 0, second_count: 0, first_count: 0 }
  for (const id of order) {
    if (id === 'intro' || id === 'holding') continue
    const [kind] = id.split(':')
    if (kind === 'consolation') c.consolation_count++
    else if (kind === 'third') c.third_count++
    else if (kind === 'second') c.second_count++
    else if (kind === 'first') c.first_count++
  }
  return c
}

/** Default factory sequence: intro, holding, then all prize slides by tier. */
export function defaultSlideOrder(counts: PrizeCounts): AwardSlideId[] {
  const out: AwardSlideId[] = ['intro', 'holding']
  for (let i = 0; i < counts.consolation_count; i++) out.push(`consolation:${i}`)
  for (let i = 0; i < counts.third_count; i++) out.push(`third:${i}`)
  for (let i = 0; i < counts.second_count; i++) out.push(`second:${i}`)
  for (let i = 0; i < counts.first_count; i++) out.push(`first:${i}`)
  return out
}

/**
 * Drop unknown / malformed ids; if nothing remains, seed with default order
 * derived from the provided counts. Safe to call with user-supplied JSON.
 */
export function normalizeSlideOrder(
  saved: unknown,
  counts: PrizeCounts,
): AwardSlideId[] {
  if (!Array.isArray(saved) || saved.length === 0) return defaultSlideOrder(counts)
  const seen = new Set<string>()
  const out: AwardSlideId[] = []
  for (const raw of saved) {
    if (typeof raw !== 'string') continue
    if (seen.has(raw)) continue
    if (raw === 'intro' || raw === 'holding') {
      out.push(raw); seen.add(raw); continue
    }
    const parts = raw.split(':')
    if (parts.length !== 2) continue
    if (!isPrizeKind(parts[0])) continue
    if (!/^\d+$/.test(parts[1])) continue
    out.push(raw); seen.add(raw)
  }
  return out.length ? out : defaultSlideOrder(counts)
}

/** Next unused numeric suffix for a given prize kind. */
export function nextPrizeId(order: AwardSlideId[], kind: PrizeKind): AwardSlideId {
  let max = -1
  for (const id of order) {
    if (id === 'intro' || id === 'holding') continue
    const [k, s] = id.split(':')
    if (k === kind) {
      const n = parseInt(s, 10)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return `${kind}:${max + 1}`
}

/** Append a new slide of the given kind. Intro/holding are singletons. */
export function addSlide(order: AwardSlideId[], kind: AwardSlideKind): AwardSlideId[] {
  if (kind === 'intro' || kind === 'holding') {
    if (order.includes(kind)) return order
    return [kind, ...order]
  }
  return [...order, nextPrizeId(order, kind)]
}

/** Remove a slide by id. */
export function removeSlide(order: AwardSlideId[], id: AwardSlideId): AwardSlideId[] {
  return order.filter(x => x !== id)
}

/**
 * Build slide descriptors. Rank-in-kind is display-order-based; team rank is
 * canonical (first tier takes ranks 1..first_count, etc.).
 */
export function buildAwardSlides(order: AwardSlideId[]): AwardSlideDescriptor[] {
  const byKind: Record<PrizeKind, AwardSlideId[]> = {
    first: [], second: [], third: [], consolation: [],
  }
  for (const id of order) {
    if (id === 'intro' || id === 'holding') continue
    const [kind] = id.split(':')
    if (isPrizeKind(kind)) byKind[kind].push(id)
  }
  const teamRankById: Record<string, number> = {}
  let rank = 1
  for (const kind of CANONICAL_KINDS) {
    for (const id of byKind[kind]) {
      teamRankById[id] = rank++
    }
  }
  return order.map(id => {
    if (id === 'intro')   return { id, kind: 'intro',   rank: null, teamRank: null }
    if (id === 'holding') return { id, kind: 'holding', rank: null, teamRank: null }
    const [kind] = id.split(':') as [PrizeKind]
    const posInKind = byKind[kind].indexOf(id)
    return { id, kind, rank: posInKind + 1, teamRank: teamRankById[id] ?? null }
  })
}
