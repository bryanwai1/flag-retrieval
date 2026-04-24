import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'ms'

const KEY = 'fr_lang'
const EVT = 'fr-lang-change'

function getLang(): Lang {
  if (typeof localStorage === 'undefined') return 'en'
  const v = localStorage.getItem(KEY)
  return v === 'ms' ? 'ms' : 'en'
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function setLang(lang: Lang) {
  try { localStorage.setItem(KEY, lang) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT))
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'en')
}
