-- Snake and Ladder: per-team points (50 points per tile completed).
-- Run in the Supabase SQL editor.

alter table snake_teams
  add column if not exists points int not null default 0;

notify pgrst, 'reload schema';
