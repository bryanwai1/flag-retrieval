import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { TaskPage } from '../types/database'

export function useBingoTaskPages(taskId: string | undefined) {
  const [pages, setPages] = useState<TaskPage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPages = useCallback(async () => {
    if (!taskId || !isSupabaseConfigured) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('bingo_task_pages')
        .select('*')
        .eq('task_id', taskId)
        .order('page_order', { ascending: true })
      if (data) setPages(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetchPages()
    if (!taskId || !isSupabaseConfigured) return
    const channel = supabase
      .channel(`bingo-pages-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_task_pages', filter: `task_id=eq.${taskId}` }, () => {
        fetchPages()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchPages, taskId])

  const createPage = async (page: Omit<TaskPage, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('bingo_task_pages').insert(page).select().single()
    if (error) throw error
    await fetchPages()
    return data
  }

  const updatePage = async (id: string, updates: Partial<TaskPage>) => {
    const { data, error } = await supabase.from('bingo_task_pages').update(updates).eq('id', id).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Save failed — no rows updated. Check RLS on bingo_task_pages.')
    await fetchPages()
  }

  const deletePage = async (id: string) => {
    const { error } = await supabase.from('bingo_task_pages').delete().eq('id', id)
    if (error) throw error
    await fetchPages()
  }

  const reorderPages = async (reordered: TaskPage[]) => {
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('bingo_task_pages').update({ page_order: i }).eq('id', reordered[i].id)
    }
    await fetchPages()
  }

  return { pages, loading, createPage, updatePage, deletePage, reorderPages, refetch: fetchPages }
}
