-- ── Bingo Dash: Team bonus points (other-game contributions) ─────────────────
-- Run once in the Supabase SQL editor.

ALTER TABLE bingo_teams
  ADD COLUMN IF NOT EXISTS bonus_points INTEGER NOT NULL DEFAULT 0;

-- Tell PostgREST to reload so the new column is visible immediately.
notify pgrst, 'reload schema';
