-- Flag Retrieval: add is_live flag to tasks
-- Cards with is_live = true appear on the Projector view and accept participant scans.
-- Cards with is_live = false stay in the admin library (unused).
-- Defaults to true so existing tasks remain visible until an admin curates them.

alter table tasks
  add column if not exists is_live boolean not null default true;

create index if not exists tasks_is_live_idx on tasks(is_live);
