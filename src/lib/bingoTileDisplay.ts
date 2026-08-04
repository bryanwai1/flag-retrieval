// Non-JSX helpers behind the per-board bingo tile display mode
// (bingo_sections.tile_display). The tile faces themselves live in
// components/BingoTileFace.tsx — kept apart so that file only exports
// components (React Fast Refresh requirement).

export type TileDisplay = 'icon' | 'words'

export function normalizeTileDisplay(value: string | null | undefined): TileDisplay {
  return value === 'words' ? 'words' : 'icon'
}

// ── Category → icon mapping ───────────────────────────────────────────────────
// Keyword rules map each admin-defined category to the best-fitting icon, with a
// stable hash fallback so even brand-new categories always get a consistent one.

const ICON_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\ba\.?i\b|artificial|robot|cyber|android|machine|\btech\b|digital/, 'cpu'],
  [/physical|fitness|exercise|workout|cardio|sport|\brun\b|athlet|agilit/, 'activity'],
  [/strength|power|\blift\b|\bgym\b|muscle|endurance/, 'activity'],
  [/team|group|squad|crew|together|collab|unity|partner/, 'users'],
  [/compet|versus|battle|tournament|champion|\brace\b|rival|relay/, 'trophy'],
  [/hunt|search|scavenger|\bfind\b|seek|\bspot\b|locate|detect/, 'search'],
  [/puzzle|brain|logic|riddle|solve|mystery|enigma|sequence/, 'lightbulb'],
  [/quiz|trivia|knowledge|learn|study|memory|\bmind\b|\bword/, 'book'],
  [/creativ|\bart\b|craft|design|draw|paint|imagin|sculpt/, 'sparkles'],
  [/music|sound|rhythm|dance|\bsing\b|\bsong\b|\bbeat\b|audio/, 'music'],
  [/photo|picture|\bsnap\b|camera|selfie|\bimage\b|video|film/, 'camera'],
  [/talk|communicat|speak|language|debate|present|story|express|tongue/, 'message'],
  [/\bmap\b|location|\bplace\b|travel|navigat|route|explore|adventure|journey|world/, 'compass'],
  [/energy|speed|\bfast\b|quick|electric|spark|flash|reflex/, 'zap'],
  [/challenge|mission|\btask\b|\bgame\b|\bplay\b|activit|round|stage|tower|cube|shape|stack/, 'target'],
]

export function resolveIconKey(category: string): string {
  const c = (category || '').toLowerCase()
  for (const [re, key] of ICON_RULES) if (re.test(c)) return key
  let h = 0
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0
  const generics = ['star', 'target', 'flag', 'zap', 'compass', 'sparkles']
  return generics[h % generics.length] || 'star'
}

// ── Words mode ────────────────────────────────────────────────────────────────

// Trim a title down to what actually fits a tile. Leading filler verbs carry no
// information at this size, so they go first; then we cut on a word boundary.
// The full title is still one tap away (and lives in the tile's title/aria).
const FILLER = /^(?:please\s+|go\s+(?:and\s+)?|try\s+to\s+|make\s+sure\s+to\s+|you\s+must\s+|complete\s+the\s+|the\s+)/i

export function shortenTitle(title: string, maxChars = 20): string {
  const clean = (title || '').trim().replace(FILLER, '')
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
