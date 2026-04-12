export interface Task {
  id: string
  color: string
  hex_code: string
  title: string
  sort_order: number
  created_at: string
}

export interface TaskPage {
  id: string
  task_id: string
  page_order: number
  media_url: string | null
  media_type: 'image' | 'video' | null
  pointer_1: string | null
  pointer_2: string | null
  pointer_3: string | null
  pointer_4: string | null
  pointer_5: string | null
  pointer_6: string | null
  created_at: string
}

export interface Team {
  id: string
  name: string
  created_at: string
}

export interface TeamScan {
  id: string
  team_id: string
  task_id: string
  scanned_at: string
  completed: boolean
  completed_at: string | null
}
