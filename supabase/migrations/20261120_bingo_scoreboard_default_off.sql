-- Player scoreboard is now OFF by default.
-- Players still see their own team's points and completed count on their phone;
-- show_scoreboard only controls the full all-teams ranking (🏆 Scoreboard button).
-- The projector and award slides are unaffected.
-- Turn it back ON per board in Bingo Dash admin → "Show scoreboard on players' phones".
-- Run this in the Supabase SQL editor for the "Flag Retrieval" project.

ALTER TABLE bingo_sections
  ALTER COLUMN show_scoreboard SET DEFAULT false;

UPDATE bingo_sections SET show_scoreboard = false;
