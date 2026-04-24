import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Task } from '../types/database'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('sort_order', { ascending: true })
      if (data) setTasks(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchTasks])

  const createTask = async (task: Omit<Task, 'id' | 'created_at' | 'is_live'> & { is_live?: boolean }) => {
    const { data, error } = await supabase.from('tasks').insert(task).select().single()
    if (error) throw error
    return data
  }

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id)
    if (error) throw error
  }

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  }

  const duplicateTask = async (sourceId: string): Promise<Task> => {
    const { data: src, error: srcErr } = await supabase
      .from('tasks').select('*').eq('id', sourceId).single()
    if (srcErr || !src) throw srcErr ?? new Error('Source task not found')

    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order), 0)
    const { data: newTask, error: insErr } = await supabase
      .from('tasks')
      .insert({
        color: src.color,
        hex_code: src.hex_code,
        title: `${src.title} (Copy)`,
        sort_order: maxOrder + 1,
        points: src.points,
        is_live: false,
      })
      .select()
      .single()
    if (insErr || !newTask) throw insErr ?? new Error('Failed to create duplicate')

    const { data: pages } = await supabase
      .from('task_pages').select('*').eq('task_id', sourceId).order('page_order', { ascending: true })
    if (pages && pages.length) {
      const rows = pages.map(({ id: _id, created_at: _c, ...rest }: Record<string, unknown>) => ({
        ...rest,
        task_id: newTask.id,
      }))
      await supabase.from('task_pages').insert(rows)
    }

    const { data: photos } = await supabase
      .from('task_photos').select('*').eq('task_id', sourceId).order('photo_order', { ascending: true })
    if (photos && photos.length) {
      const rows = photos.map(({ id: _id, created_at: _c, ...rest }: Record<string, unknown>) => ({
        ...rest,
        task_id: newTask.id,
      }))
      await supabase.from('task_photos').insert(rows)
    }

    const { data: links } = await supabase
      .from('task_links').select('*').eq('task_id', sourceId).order('sort_order', { ascending: true })
    if (links && links.length) {
      const rows = links.map(({ id: _id, created_at: _c, ...rest }: Record<string, unknown>) => ({
        ...rest,
        task_id: newTask.id,
      }))
      await supabase.from('task_links').insert(rows)
    }

    return newTask
  }

  return { tasks, loading, createTask, updateTask, deleteTask, duplicateTask, refetch: fetchTasks }
}
