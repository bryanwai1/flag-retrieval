import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Settings are per-tenant: unique (owner_id, key) with owner_id NULL = house.
// The default ownerValue (null) keeps global-key callers (briefing slides,
// projector ranking order) working against house rows unchanged.
export function useSetting(key: string, defaultValue: string, ownerValue: string | null = null) {
  const [value, setValue] = useState(defaultValue)

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return
    let query = supabase.from('settings').select('value').eq('key', key)
    query = ownerValue === null ? query.is('owner_id', null) : query.eq('owner_id', ownerValue)
    const { data } = await query.maybeSingle()
    setValue(data ? data.value : defaultValue)
    // defaultValue is intentionally read once per fetch; callers pass literals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ownerValue])

  useEffect(() => {
    fetch()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel(`setting-${key}-${ownerValue ?? 'house'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${key}` }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch, key, ownerValue])

  const set = useCallback(async (newValue: string) => {
    setValue(newValue)
    await supabase.from('settings').upsert(
      { key, value: newValue, owner_id: ownerValue },
      { onConflict: 'owner_id,key' },
    )
  }, [key, ownerValue])

  return [value, set] as const
}
