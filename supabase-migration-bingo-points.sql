-- ── Bingo Dash: Points per tile ──────────────────────────────────────────────
-- Run this in the Supabase SQL editor

-- Add points column to bingo_tasks (default 0)
ALTER TABLE bingo_tasks
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
