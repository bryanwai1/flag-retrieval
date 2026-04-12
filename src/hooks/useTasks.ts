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

  const createTask = async (task: Omit<Task, 'id' | 'created_at'>) => {
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

  return { tasks, loading, createTask, updateTask, deleteTask, refetch: fetchTasks }
}
