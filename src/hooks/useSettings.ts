import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function useSetting(key: string, defaultValue: string) {
  const [value, setValue] = useState(defaultValue)

  const fetch = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase.from('settings').select('value').eq('key', key).single()
    if (data) setValue(data.value)
  }, [key])

  useEffect(() => {
    fetch()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel(`setting-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${key}` }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch, key])

  const set = useCallback(async (newValue: string) => {
    setValue(newValue)
    await supabase.from('settings').upsert({ key, value: newValue })
  }, [key])

  return [value, set] as const
}
