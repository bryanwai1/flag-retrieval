-- Adds Numbers mode to Shape Sequence rounds.
-- Each round can be either 'shapes' (existing) or 'numbers' (1..circle_count).
-- Run once in the Supabase SQL editor.

alter table shape_rounds
  add column if not exists mode text not null default 'shapes';

alter table shape_rounds
  drop constraint if exists shape_rounds_mode_check;

alter table shape_rounds
  add constraint shape_rounds_mode_check check (mode in ('shapes', 'numbers'));

alter table shape_rounds
  add column if not exists numbers jsonb not null default '[]'::jsonb;
