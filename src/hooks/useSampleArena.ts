import { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// ════════════════════════════════════════════════════════════════════════════
// SAMPLE ARENA — many phones, one scoreboard, still zero DB writes.
//
// Everyone who scans the host's QR joins `sample-arena-<code>` and publishes
// their live score into Supabase Realtime PRESENCE. Every device in the channel
// therefore sees every team, and a device that joins late (the projector, or a
// phone that arrives halfway through) is handed the whole board on its first
// sync — which is why this is presence rather than plain broadcast.
//
// Nothing is persisted: the sample writes to no table, so a public demo can
// never turn up in a real event's data.
//
// One deliberate deviation from raw presence: presence drops a team the moment
// its socket does — a phone sleeping mid-round would wipe that team off the
// projector. So the roster here is STICKY. Teams are merged in and kept for the
// life of the page; the demo ends when the host closes the screen.
// ════════════════════════════════════════════════════════════════════════════

export type ArenaScore = {
  team: string
  points: number
  tasksDone: number
  bingos: number
  /** Board size, so the host can show "12/25" without loading the board twice. */
  total: number
  /** Report time — the newest report for a team is the one that counts. */
  at: number
}

/** What a device hands in. The clock is the hook's business, not the caller's. */
export type ArenaReport = Omit<ArenaScore, 'at'>

/** Short, unambiguous arena code (no 0/O/1/I, so it can be read off a screen). */
export function makeArenaCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/**
 * Join the arena and watch everyone in it.
 *
 * `mine` is this device's live score, or null for a host that is only watching.
 * Memoise it in the caller — every new object identity is another presence
 * update on the wire.
 */
export function useSampleArena(code: string | null, mine: ArenaReport | null): ArenaScore[] {
  const [teams, setTeams] = useState<ArenaScore[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Read on subscribe, so a score that existed before the socket opened is
  // still published once it does. Declared first so it is already current by
  // the time the channel below asks for it.
  const mineRef = useRef(mine)
  useEffect(() => { mineRef.current = mine }, [mine])

  useEffect(() => {
    if (!code || !isSupabaseConfigured) return
    const channel = supabase.channel(`sample-arena-${code}`, {
      config: { presence: { key: Math.random().toString(36).slice(2) } },
    })
    channel.on('presence', { event: 'sync' }, () => {
      const seen: ArenaScore[] = []
      for (const entries of Object.values(channel.presenceState())) {
        for (const entry of entries as unknown as ArenaScore[]) {
          if (entry && typeof entry.team === 'string' && entry.team.trim() !== '') seen.push(entry)
        }
      }
      setTeams(prev => mergeTeams(prev, seen))
    })
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED' && mineRef.current) channel.track({ ...mineRef.current, at: Date.now() })
    })
    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [code])

  // Push our own score on every change. No local shortcut is needed: presence
  // echoes our own entry back in the next sync, so we land on the board through
  // exactly the same path as everyone else.
  useEffect(() => {
    if (!mine) return
    channelRef.current?.track({ ...mine, at: Date.now() })
  }, [mine])

  return teams
}

/** Newest report per team wins; a team already seen is never dropped. */
function mergeTeams(prev: ArenaScore[], incoming: ArenaScore[]): ArenaScore[] {
  const byTeam = new Map(prev.map(t => [t.team, t]))
  let changed = false
  for (const t of incoming) {
    const old = byTeam.get(t.team)
    if (!old || t.at >= old.at) {
      if (!old || old.points !== t.points || old.tasksDone !== t.tasksDone || old.bingos !== t.bingos) changed = true
      byTeam.set(t.team, t)
    }
  }
  return changed || byTeam.size !== prev.length ? [...byTeam.values()] : prev
}
