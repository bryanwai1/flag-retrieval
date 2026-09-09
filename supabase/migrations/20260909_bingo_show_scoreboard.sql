-- Per-board switch for the live scoreboard on the player / observer page.
-- ON (default) — players and observers get a 🏆 Scoreboard tab beside their
--   board, showing the same standings as the projector.
-- OFF — the tab is hidden, so the facilitator can keep the standings a secret
--   until the reveal on the projector.
ALTER TABLE bingo_sections
  ADD COLUMN IF NOT EXISTS show_scoreboard boolean NOT NULL DEFAULT true;
