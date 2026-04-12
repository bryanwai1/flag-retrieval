import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

let _supabase: SupabaseClient | null = null

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = _supabase as SupabaseClient

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
  }
  return _supabase
}
