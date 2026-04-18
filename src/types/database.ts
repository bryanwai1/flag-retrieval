export interface Task {
  id: string
  color: string
  hex_code: string
  title: string
  sort_order: number
  points: number
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
  example_1: string | null
  example_2: string | null
  example_3: string | null
  example_4: string | null
  example_5: string | null
  example_6: string | null
  icon_1: string | null
  icon_2: string | null
  icon_3: string | null
  icon_4: string | null
  icon_5: string | null
  icon_6: string | null
  created_at: string
}

export interface TaskPhoto {
  id: string
  task_id: string
  photo_url: string
  photo_order: number
  position_x: number
  position_y: number
  caption: string | null
  created_at: string
}

export interface Team {
  id: string
  name: string
  password: string
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

// ── Bingo Dash ────────────────────────────────────────────────

export interface BingoSection {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export interface BingoChallengeSection {
  id: string
  game_section_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface BingoCategory {
  id: string
  section_id: string
  challenge_section_id: string | null
  name: string
  sort_order: number
  created_at: string
}

export interface BingoTask {
  id: string
  section_id: string
  title: string
  color: string
  hex_code: string
  sort_order: number
  in_grid: boolean
  category: string
  points: number
  task_type: 'standard' | 'answer'
  answer_question: string | null
  answer_text: string | null
  completion_warning: string | null
  require_marshal: boolean
  created_at: string
}

export interface BingoSettings {
  id: string
  timer_seconds: number
  timer_end_at: string | null
  active_section_id: string | null
  marshal_password: string
  created_at: string
}

// Same shape as TaskPage — uses bingo_task_pages table
export type BingoTaskPage = TaskPage

// Same shape as TaskPhoto — uses bingo_task_photos table
export type BingoTaskPhoto = TaskPhoto

export interface BingoTeam {
  id: string
  section_id: string
  name: string
  password: string
  photo_url: string | null
  bonus_points: number
  created_at: string
}

export interface BingoScan {
  id: string
  team_id: string
  task_id: string
  scanned_at: string
  completed: boolean
  completed_at: string | null
}

export interface BingoMember {
  id: string
  team_id: string
  section_id: string
  name: string
  password: string
  created_at: string
}

// ── Snake and Ladder ──────────────────────────────────────────

export interface SnakeGame {
  id: string
  name: string
  snakes: Record<string, number>   // head -> tail
  ladders: Record<string, number>  // bottom -> top
  created_at: string
}

export interface SnakeTile {
  id: string
  game_id: string
  tile_number: number
  task_id: string | null
  created_at: string
}

export interface SnakeTeam {
  id: string
  game_id: string
  name: string
  hex_code: string
  emoji: string | null
  position: number
  sort_order: number
  created_at: string
}

export interface SnakeSettings {
  id: string
  active_game_id: string | null
}
