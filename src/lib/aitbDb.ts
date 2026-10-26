/**
 * AITB player demo — swaps the Supabase client for an in-memory fake.
 * -------------------------------------------------------------------
 * `/aitb/home?demo=1` sets a per-tab flag (sessionStorage), so the player pages
 * (home + mission) run exactly as in the real game but against a throwaway DB
 * that lives in this tab only. Nothing reaches the live event data. Closing the
 * tab resets the demo. Real players never have the flag.
 *
 * Only the queries the player pages use are implemented.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as realSupabase, isSupabaseConfigured as realConfigured } from './supabase'

const FLAG = 'aitb_demo'
const DB_KEY = 'aitb_demo_db'
export const DEMO_MARSHAL_CODE = '4321'

export function isDemo(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('demo') === '1') sessionStorage.setItem(FLAG, '1')
    return sessionStorage.getItem(FLAG) === '1'
  } catch { return false }
}

type Row = Record<string, unknown>
type Db = { aitb_teams: Row[]; aitb_progress: Row[]; aitb_settings: Row[] }

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

function seed(): Db {
  const team = (id: string, name: string, color: string, sort_order: number): Row =>
    ({ id, name, color, sort_order, adjust: 0, created_at: ago(60) })
  // Rivals start with a little progress so the rank chip means something.
  const done = (team_id: string, activity_id: number, bonus: number): Row => ({
    id: crypto.randomUUID(), team_id, activity_id, scanned_at: ago(30), steps_done: [], completed_at: ago(10),
    bonus, words: [], created_at: ago(30),
  })
  return {
    aitb_teams: [
      team('demo-alpha', 'Sample Team Alpha', '#2dd4bf', 0),
      team('demo-beta', 'Sample Team Beta', '#f472b6', 1),
      team('demo-gamma', 'Sample Team Gamma', '#facc15', 2),
      team('demo-delta', 'Sample Team Delta', '#a78bfa', 3),
    ],
    aitb_progress: [done('demo-beta', 1, 100), done('demo-gamma', 2, 50)],
    aitb_settings: [{ id: 1, admin_password: DEMO_MARSHAL_CODE, game_ends_at: null }],
  }
}

function loadDb(): Db {
  try {
    const raw = sessionStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch { /* fall through to a fresh seed */ }
  const db = seed()
  saveDb(db)
  return db
}
function saveDb(db: Db) {
  try { sessionStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* private mode: demo still works per page */ }
}

type Op = 'select' | 'upsert' | 'update' | 'delete'

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private op: Op = 'select'
  private filters: [string, unknown][] = []
  private orders: string[] = []
  private payload: Row = {}
  private ignoreDuplicates = false
  private conflict: string[] = []
  private returning = true
  private single = false

  private table: keyof Db
  constructor(table: keyof Db) { this.table = table }

  select() { if (this.op !== 'select') this.returning = true; return this }
  upsert(row: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert'; this.payload = row; this.returning = false
    this.conflict = (opts?.onConflict ?? 'id').split(',')
    this.ignoreDuplicates = !!opts?.ignoreDuplicates
    return this
  }
  update(patch: Row) { this.op = 'update'; this.payload = patch; this.returning = false; return this }
  delete() { this.op = 'delete'; this.returning = false; return this }
  eq(col: string, val: unknown) { this.filters.push([col, val]); return this }
  order(col: string) { this.orders.push(col); return this }
  maybeSingle() { this.single = true; return this }

  private run(): { data: unknown; error: null } {
    const db = loadDb()
    const rows = db[this.table]
    const match = (r: Row) => this.filters.every(([c, v]) => r[c] === v)
    let out: Row[] = []
    if (this.op === 'select') {
      out = rows.filter(match)
    } else if (this.op === 'upsert') {
      const hit = rows.find(r => this.conflict.every(c => r[c] === this.payload[c]))
      if (hit) {
        if (!this.ignoreDuplicates) Object.assign(hit, this.payload)
        out = this.ignoreDuplicates ? [] : [hit]
      } else {
        const row: Row = { id: crypto.randomUUID(), steps_done: [], completed_at: null, bonus: 0, words: [], created_at: new Date().toISOString(), ...this.payload }
        rows.push(row)
        out = [row]
      }
    } else if (this.op === 'update') {
      out = rows.filter(match)
      out.forEach(r => Object.assign(r, this.payload))
    } else {
      db[this.table] = rows.filter(r => !match(r))
    }
    if (this.op !== 'select') saveDb(db)
    for (const col of this.orders) out = [...out].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? ''), undefined, { numeric: true }))
    const clone = JSON.parse(JSON.stringify(out)) as Row[]
    if (this.single) return { data: clone[0] ?? null, error: null }
    return { data: this.returning || this.op === 'select' ? clone : null, error: null }
  }

  then<R1 = { data: unknown; error: null }, R2 = never>(
    ok?: ((v: { data: unknown; error: null }) => R1 | PromiseLike<R1>) | null,
    fail?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ) {
    return Promise.resolve().then(() => this.run()).then(ok, fail)
  }
}

// Realtime / broadcast channels do nothing in the demo — state is local.
const channel = {
  on() { return channel }, subscribe() { return channel }, send() { return Promise.resolve('ok') },
}
const fakeClient = {
  from: (table: keyof Db) => new Query(table),
  channel: () => channel,
  removeChannel: () => Promise.resolve('ok'),
}

const demo = isDemo()
export const supabase = (demo ? fakeClient : realSupabase) as unknown as SupabaseClient
export const isSupabaseConfigured = demo || realConfigured
/** localStorage key for the picked team — separate in the demo so a real choice is never overwritten. */
export const AITB_TEAM_KEY = demo ? 'aitb_my_team_demo' : 'aitb_my_team'
/** Marshal-code field starts filled in the demo (empty in the real game). */
export const AITB_PW_PREFILL = demo ? DEMO_MARSHAL_CODE : ''
/** Demo only: wipe the fake DB so the next read re-seeds it. No-op in the real game. */
export function resetDemo() {
  if (!demo) return
  try { sessionStorage.removeItem(DB_KEY) } catch { /* nothing to clear */ }
}
/** True when this tab is running the player demo. */
export const IS_DEMO = demo
