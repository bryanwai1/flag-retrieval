// Turn user-entered link text into a navigable URL.
// - Full URLs (https://, mailto:, tel:, etc.) pass through.
// - Bare hosts (maps.app.goo.gl/x) get https:// prefixed.
// - Anything else (Plus Codes, addresses, place names) is wrapped in a
//   Google Maps search query so it opens the location in Maps.
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  const looksLikeHost =
    /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed) ||
    /^localhost(:\d+)?(\/.*)?$/i.test(trimmed)
  if (looksLikeHost) return `https://${trimmed}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
}
