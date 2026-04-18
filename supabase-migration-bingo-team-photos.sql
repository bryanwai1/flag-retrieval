-- ── Bingo Dash: Team photo (icon for winner slides) ─────────────────────────
-- Run once in the Supabase SQL editor.

ALTER TABLE bingo_teams
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Tell PostgREST to reload so the new column is visible immediately.
notify pgrst, 'reload schema';
