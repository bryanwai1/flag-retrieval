import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/** Whole-game countdown shared by admin, projector and mission pages.
 *  Follows aitb_settings.game_ends_at over realtime; null = no timer set. */
export function useAitbGameTimer() {
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.from('aitb_settings').select('game_ends_at').eq('id', 1).maybeSingle()
      if (!cancelled) setEndsAt(data?.game_ends_at ?? null)
    }
    load()
    const channel = supabase
      .channel('aitb-game-timer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aitb_settings' }, load)
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!endsAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [endsAt])

  const remainingMs = endsAt ? new Date(endsAt).getTime() - now : null
  const timeUp = remainingMs !== null && remainingMs <= 0
  return { endsAt, remainingMs, timeUp }
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
