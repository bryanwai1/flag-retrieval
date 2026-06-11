-- Bingo Dash: helpful links per task
-- Run this in the Supabase SQL editor for the "Flag Retrieval" project.

create table if not exists bingo_task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references bingo_tasks(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_bingo_task_links_task_id on bingo_task_links(task_id, sort_order);

alter table bingo_task_links enable row level security;

drop policy if exists "bingo_task_links: public read"   on bingo_task_links;
drop policy if exists "bingo_task_links: public write"  on bingo_task_links;
drop policy if exists "bingo_task_links: public update" on bingo_task_links;
drop policy if exists "bingo_task_links: public delete" on bingo_task_links;

create policy "bingo_task_links: public read"   on bingo_task_links for select using (true);
create policy "bingo_task_links: public write"  on bingo_task_links for insert with check (true);
create policy "bingo_task_links: public update" on bingo_task_links for update using (true) with check (true);
create policy "bingo_task_links: public delete" on bingo_task_links for delete using (true);

alter publication supabase_realtime add table bingo_task_links;
