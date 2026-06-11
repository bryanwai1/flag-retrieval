-- Bingo Dash: per-board timer + settings
-- Each board (bingo_sections row) gets its own timer, time's-up alarm,
-- marshal password and photo-submissions toggle. Only cards stay universal.
-- Run this in the Supabase SQL editor for the "Flag Retrieval" project.

alter table bingo_sections
  add column if not exists timer_seconds int not null default 0,
  add column if not exists timer_end_at timestamptz,
  add column if not exists time_up_message text not null default '',
  add column if not exists time_up_label text not null default '',
  add column if not exists time_up_maps_url text not null default '',
  add column if not exists marshal_password text not null default '1234',
  add column if not exists photo_submissions_enabled boolean not null default true;

-- Seed every board from the old global settings so nothing changes at cutover.
update bingo_sections s set
  timer_seconds             = coalesce(g.timer_seconds, 0),
  timer_end_at              = g.timer_end_at,
  time_up_message           = coalesce(g.time_up_message, ''),
  time_up_label             = coalesce(g.time_up_label, ''),
  time_up_maps_url          = coalesce(g.time_up_maps_url, ''),
  marshal_password          = coalesce(g.marshal_password, '1234'),
  photo_submissions_enabled = coalesce(g.photo_submissions_enabled, true)
from bingo_settings g
where g.id = 'main';

-- bingo_sections is already in the supabase_realtime publication (live
-- game_started updates depend on it), so no publication change is needed.
