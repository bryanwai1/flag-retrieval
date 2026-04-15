-- ── Bingo Dash: grid selection + team password ────────────────────────────────
-- Run this in your Supabase SQL editor.

-- 1. Add in_grid flag to bingo_tasks
--    Controls which tiles appear in the 5×5 player board (max 25).
ALTER TABLE bingo_tasks
  ADD COLUMN IF NOT EXISTS in_grid boolean NOT NULL DEFAULT false;

-- 2. Add password to bingo_teams
--    Teams are identified by name + password combo.
--    Existing teams get an empty password (they can still re-join with no password).
ALTER TABLE bingo_teams
  ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT '';
