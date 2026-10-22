-- AI Team Building: admin-editable game list.
-- activities = the admin's version of the games (null = built-in 10).
-- Dropping the 1..10 check lets the admin add games 11, 12, ...
-- Run once in the Supabase SQL editor.

alter table aitb_settings add column if not exists activities jsonb;
alter table aitb_progress drop constraint if exists aitb_progress_activity_id_check;

notify pgrst, 'reload schema';
