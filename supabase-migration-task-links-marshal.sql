-- Flag Retrieval: task links + marshal password
-- Run this in the Supabase SQL editor for the "Flag Retrieval" project.

-- ── 1. task_links: multiple URL links per task ───────────────────────────
create table if not exists task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_task_links_task_id on task_links(task_id, sort_order);

alter table task_links enable row level security;

drop policy if exists "task_links: public read"   on task_links;
drop policy if exists "task_links: public write"  on task_links;
drop policy if exists "task_links: public update" on task_links;
drop policy if exists "task_links: public delete" on task_links;

create policy "task_links: public read"   on task_links for select using (true);
create policy "task_links: public write"  on task_links for insert with check (true);
create policy "task_links: public update" on task_links for update using (true) with check (true);
create policy "task_links: public delete" on task_links for delete using (true);

alter publication supabase_realtime add table task_links;

-- ── 2. Seed default marshal password (4-digit, '1234') ───────────────────
insert into settings (key, value) values ('marshal_password', '1234')
  on conflict (key) do nothing;
