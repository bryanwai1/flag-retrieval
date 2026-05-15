-- Chain of Unity stations: expand each station card into the 6-pointer model.
-- Adds objective + 6 pointer/icon slots + marshal-only fields (materials, role,
-- time limit). The legacy `body` column is kept for back-compat; new stations
-- should use pointers instead.
--
-- Run AFTER 20260515_chain_of_unity_stations.sql in the same Supabase project.
-- Idempotent — safe to re-run.

alter table chain_stations
  add column if not exists objective       text,
  add column if not exists materials       text,
  add column if not exists marshal_role    text,
  add column if not exists time_limit_min  int not null default 7,
  add column if not exists pointer_1       text,
  add column if not exists pointer_2       text,
  add column if not exists pointer_3       text,
  add column if not exists pointer_4       text,
  add column if not exists pointer_5       text,
  add column if not exists pointer_6       text,
  add column if not exists icon_1          text,
  add column if not exists icon_2          text,
  add column if not exists icon_3          text,
  add column if not exists icon_4          text,
  add column if not exists icon_5          text,
  add column if not exists icon_6          text;

notify pgrst, 'reload schema';
