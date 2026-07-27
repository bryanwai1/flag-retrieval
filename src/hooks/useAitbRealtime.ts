import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Sub = { table: string; filter?: string }

/**
 * Realtime subscription for the AITB surfaces, hardened against the failure mode
 * the stress test flagged: a plain `postgres_changes` handler only fires while
 * the socket is healthy, so a dropped connection (venue wifi, a sleeping
 * projector) silently freezes the screen until the next change happens to
 * arrive. This hook adds three safety nets on top of the live subscription:
 *   1. refetch on every (re)SUBSCRIBED — backfills whatever was missed while the
 *      channel was down, the moment it rejoins;
 *   2. a slow poll (default 15s) in case the socket stalls without a status event;
 *   3. refetch on tab refocus / network `online`.
 * `load` should be a useCallback so its identity is stable.
 */
export function useAitbRealtime(
  channelName: string,
  subs: Sub[],
  load: () => void,
  pollMs = 15000,
) {
  const subsKey = JSON.stringify(subs)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let channel = supabase.channel(channelName)
    for (const s of subs) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        load,
      )
    }
    channel.subscribe(status => {
      // Fires on the first join AND every rejoin after a drop → backfill.
      if (status === 'SUBSCRIBED') load()
    })
    const poll = setInterval(load, pollMs)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('online', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(poll)
      window.removeEventListener('online', load)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
    // subs is compared by value via subsKey; load/channelName/pollMs by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, load, pollMs, subsKey])
}
