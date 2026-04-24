import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TaskLink } from '../types/database'

export function useTaskLinks(taskId: string | undefined) {
  const [links, setLinks] = useState<TaskLink[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLinks = useCallback(async () => {
    if (!taskId || !isSupabaseConfigured) { setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('task_links')
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true })
      if (error) {
        // Table may not exist yet (pre-migration). Fail quiet — UI stays functional.
        setLinks([])
      } else if (data) {
        setLinks(data)
      }
    } catch {
      setLinks([])
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetchLinks()
    if (!taskId || !isSupabaseConfigured) return
    try {
      const channel = supabase
        .channel(`task-links-${taskId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `task_id=eq.${taskId}` }, fetchLinks)
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    } catch { /* realtime unavailable — ignore */ }
  }, [fetchLinks, taskId])

  const createLink = async (label: string, url: string) => {
    if (!taskId) return
    const { error } = await supabase.from('task_links').insert({
      task_id: taskId,
      label: label.trim(),
      url: url.trim(),
      sort_order: links.length,
    })
    if (error) throw error
    await fetchLinks()
  }

  const updateLink = async (id: string, updates: Partial<Pick<TaskLink, 'label' | 'url'>>) => {
    const { error } = await supabase.from('task_links').update(updates).eq('id', id)
    if (error) throw error
    await fetchLinks()
  }

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from('task_links').delete().eq('id', id)
    if (error) throw error
    await fetchLinks()
  }

  const reorderLinks = async (reordered: TaskLink[]) => {
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('task_links').update({ sort_order: i }).eq('id', reordered[i].id)
    }
    await fetchLinks()
  }

  return { links, loading, createLink, updateLink, deleteLink, reorderLinks, refetch: fetchLinks }
}
