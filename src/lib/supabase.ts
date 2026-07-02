import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

let _supabase: SupabaseClient | null = null

// supabase-js's default Navigator LockManager lock can steal from its own
// concurrent acquisitions during page init ("Lock ... was released because
// another request stole it"), which kills session recovery and strands the
// admin on the login page despite a valid stored session. Serialize auth
// operations with an in-tab promise queue instead.
let authLockQueue: Promise<unknown> = Promise.resolve()
const inTabAuthLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const run = authLockQueue.then(fn)
  authLockQueue = run.catch(() => {})
  return run
}

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { lock: inTabAuthLock },
  })
}

export const supabase = _supabase as SupabaseClient

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
  }
  return _supabase
}
