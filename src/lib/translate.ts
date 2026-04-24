const CACHE_KEY = 'fr_translate_ms_v1'
const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()
let loaded = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string>
      for (const k in obj) cache.set(k, obj[k])
    }
  } catch { /* ignore */ }
}

function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const obj: Record<string, string> = {}
      cache.forEach((v, k) => { obj[k] = v })
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
    } catch { /* ignore */ }
  }, 500)
}

export function getCachedMs(text: string): string | null {
  load()
  return cache.get(text) ?? null
}

export function translateToMs(text: string): Promise<string> {
  if (!text || !text.trim()) return Promise.resolve(text)
  load()
  const cached = cache.get(text)
  if (cached) return Promise.resolve(cached)
  const existing = inflight.get(text)
  if (existing) return existing
  const promise = (async () => {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ms`
      const resp = await fetch(url)
      const data = await resp.json()
      const translated = (data?.responseData?.translatedText as string) || text
      cache.set(text, translated)
      scheduleSave()
      return translated
    } catch {
      return text
    } finally {
      inflight.delete(text)
    }
  })()
  inflight.set(text, promise)
  return promise
}
