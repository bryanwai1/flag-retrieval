import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export type AitbReaction = { id: string; teamId: string; emoji: string }

/** The 5 audience reactions — a mix of cheer and playful taunt. */
export const AITB_REACTIONS = ['🔥', '🚀', '👏', '😂', '🐌'] as const

// ── Module-level singleton reaction bus ──────────────────────────────────────
// One shared broadcast channel for the whole tab, created once. A per-component
// channel breaks under React StrictMode's mount→unmount→mount, which races two
// subscribers on the same topic; a singleton with fan-out listeners avoids that.
type Listener = (r: AitbReaction) => void
const listeners = new Set<Listener>()
let channel: ReturnType<typeof supabase.channel> | null = null
let seq = 0
const nextId = () => `${Date.now()}-${seq++}`

function ensureChannel() {
  if (channel || !isSupabaseConfigured) return channel
  channel = supabase.channel('aitb-reactions', { config: { broadcast: { self: false } } })
  channel.on('broadcast', { event: 'react' }, ({ payload }) => {
    const t = payload?.teamId, e = payload?.emoji
    if (typeof t === 'string' && typeof e === 'string') {
      const r = { id: nextId(), teamId: t, emoji: e }
      listeners.forEach(l => l(r))
    }
  })
  channel.subscribe()
  return channel
}

/** Broadcast a reaction to every other client and echo it locally (self:false → no double). */
function sendAitbReaction(teamId: string, emoji: string) {
  ensureChannel()
  const local = { id: nextId(), teamId, emoji }
  listeners.forEach(l => l(local))
  channel?.send({ type: 'broadcast', event: 'react', payload: { teamId, emoji } })
}

/**
 * Ephemeral reaction feed. Observers `sendReaction(teamId, emoji)`; the projector
 * and every observer receive them and float them off the matching team's rocket.
 * Reactions auto-expire ~3.2s after they arrive.
 */
export function useAitbReactions({ listen = true }: { listen?: boolean } = {}) {
  const [reactions, setReactions] = useState<AitbReaction[]>([])

  useEffect(() => {
    ensureChannel()
    // Send-only callers (a player's cheer bar) skip the listener: otherwise every
    // player's phone would re-render and hold a 3.2s timer for every emoji fired
    // by anyone in the room, for a `reactions` list they never render.
    if (!listen) return
    const onReaction: Listener = r => {
      setReactions(rs => (rs.length > 60 ? rs.slice(-40) : rs).concat(r))
      setTimeout(() => setReactions(rs => rs.filter(x => x.id !== r.id)), 3200)
    }
    listeners.add(onReaction)
    return () => { listeners.delete(onReaction) }
  }, [listen])

  const sendReaction = useCallback((teamId: string, emoji: string) => sendAitbReaction(teamId, emoji), [])
  return { reactions, sendReaction }
}
