-- ── Bingo Dash: Game Lock ─────────────────────────────────────────────────────
-- Adds a game_started flag to bingo_settings so admin can control when
-- participants are allowed to access the game board.
-- Run this in the Supabase SQL editor.

ALTER TABLE bingo_settings
  ADD COLUMN IF NOT EXISTS game_started BOOLEAN NOT NULL DEFAULT false;
