import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeUrl } from '../lib/normalizeUrl'
import type { BingoSettings } from '../types/database'

// Returns true when the bingo timer was running (timer_end_at set) and that
// moment has now passed. Re-evaluates on a 1s tick so the alarm appears as
// soon as the timer hits zero, even without a settings update.
function useTimerExpired(settings: BingoSettings | null): boolean {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!settings?.timer_end_at) return
    const id = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [settings?.timer_end_at])
  if (!settings?.timer_end_at) return false
  return new Date(settings.timer_end_at).getTime() <= Date.now()
}

// Subscribes to bingo_settings 'main' so the alarm + message stay live for
// every connected player without prop drilling. Pages that already load
// settings can pass them via `settings` to skip the extra fetch.
export function TimeUpAlarm({ settings: settingsProp }: { settings?: BingoSettings | null } = {}) {
  const [settings, setSettings] = useState<BingoSettings | null>(settingsProp ?? null)
  const useOwnFetch = settingsProp === undefined

  useEffect(() => {
    if (!useOwnFetch) { setSettings(settingsProp ?? null); return }
    let cancelled = false
    supabase.from('bingo_settings').select('*').eq('id', 'main').single().then(({ data }) => {
      if (!cancelled && data) setSettings(data)
    })
    const channel = supabase
      .channel('bingo-settings-time-up-alarm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_settings', filter: 'id=eq.main' }, ({ new: row }) => {
        setSettings(row as BingoSettings)
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [useOwnFetch, settingsProp])

  const expired = useTimerExpired(settings)
  if (!expired || !settings) return null

  const message = settings.time_up_message?.trim() || "Time's up! Please return to the meeting point."
  const label = settings.time_up_label?.trim()
  const mapsHref = settings.time_up_maps_url?.trim() ? normalizeUrl(settings.time_up_maps_url.trim()) : ''

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Time's up"
      className="animate-alarm-flash fixed inset-0 z-[9999] flex items-center justify-center px-6 py-10 overflow-auto"
      style={{ touchAction: 'none' }}
      onWheelCapture={e => e.preventDefault()}
      onTouchMoveCapture={e => e.preventDefault()}
    >
      <div className="w-full max-w-2xl text-center text-white">
        <div className="text-7xl sm:text-8xl mb-4 animate-alarm-pulse">⏰</div>
        <h1
          className="font-black tracking-tight uppercase animate-alarm-pulse leading-none"
          style={{ fontSize: 'clamp(3rem, 12vw, 7rem)' }}
        >
          Time's Up!
        </h1>

        <div className="mt-8 rounded-3xl bg-black/45 backdrop-blur-sm border-2 border-white/40 px-6 py-7 sm:px-10 sm:py-9 shadow-2xl">
          <p className="text-xl sm:text-2xl font-bold leading-snug whitespace-pre-wrap">
            {message}
          </p>

          {(label || mapsHref) && (
            <div className="mt-7 flex flex-col items-center gap-3">
              {label && (
                <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-white/95">
                  <span aria-hidden>📍</span>
                  <span>{label}</span>
                </div>
              )}
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-red-700 font-black uppercase tracking-wide text-sm sm:text-base shadow-lg hover:bg-red-50 active:scale-95 transition-all"
                >
                  <span aria-hidden>🗺️</span>
                  Open in Google Maps
                </a>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-white/80">
          The game is locked
        </p>
      </div>
    </div>
  )
}
