import { useEffect, useState } from 'react'
import { useLang } from '../hooks/useLanguage'
import { translateToMs, getCachedMs } from '../lib/translate'

interface TProps {
  children: string | null | undefined
}

export function T({ children }: TProps) {
  const lang = useLang()
  const source = children ?? ''
  const [text, setText] = useState<string>(() =>
    lang === 'ms' && source ? (getCachedMs(source) ?? source) : source
  )

  useEffect(() => {
    if (lang !== 'ms' || !source) {
      setText(source)
      return
    }
    const cached = getCachedMs(source)
    if (cached) {
      setText(cached)
      return
    }
    setText(source)
    let alive = true
    translateToMs(source).then(r => { if (alive) setText(r) })
    return () => { alive = false }
  }, [lang, source])

  return <>{text}</>
}

export function useT(source: string | null | undefined): string {
  const lang = useLang()
  const text = source ?? ''
  const [out, setOut] = useState<string>(() =>
    lang === 'ms' && text ? (getCachedMs(text) ?? text) : text
  )

  useEffect(() => {
    if (lang !== 'ms' || !text) {
      setOut(text)
      return
    }
    const cached = getCachedMs(text)
    if (cached) {
      setOut(cached)
      return
    }
    setOut(text)
    let alive = true
    translateToMs(text).then(r => { if (alive) setOut(r) })
    return () => { alive = false }
  }, [lang, text])

  return out
}
