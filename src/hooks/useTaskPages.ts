import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TaskPage } from '../types/database'

export function useTaskPages(taskId: string | undefined) {
  const [pages, setPages] = useState<TaskPage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPages = useCallback(async () => {
    if (!taskId || !isSupabaseConfigured) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('task_pages')
        .select('*')
        .eq('task_id', taskId)
        .order('page_order', { ascending: true })
      if (data) setPages(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const createPage = async (page: Omit<TaskPage, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('task_pages').insert(page).select().single()
    if (error) throw error
    await fetchPages()
    return data
  }

  const updatePage = async (id: string, updates: Partial<TaskPage>) => {
    const { error } = await supabase.from('task_pages').update(updates).eq('id', id)
    if (error) throw error
    await fetchPages()
  }

  const deletePage = async (id: string) => {
    const { error } = await supabase.from('task_pages').delete().eq('id', id)
    if (error) throw error
    await fetchPages()
  }

  const reorderPages = async (reordered: TaskPage[]) => {
    const updates = reordered.map((p, i) => ({ id: p.id, page_order: i }))
    for (const u of updates) {
      await supabase.from('task_pages').update({ page_order: u.page_order }).eq('id', u.id)
    }
    await fetchPages()
  }

  return { pages, loading, createPage, updatePage, deletePage, reorderPages, refetch: fetchPages }
}
