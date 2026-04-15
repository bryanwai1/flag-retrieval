-- Bingo Dash: Sections (each section = one independent game/location)
-- Run once in the Supabase SQL editor.

create table if not exists bingo_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Seed a default section and migrate any existing tasks/teams into it.
insert into bingo_sections (name, slug, sort_order)
  values ('Default', 'default', 0)
  on conflict (slug) do nothing;

-- bingo_tasks.section_id
alter table bingo_tasks add column if not exists section_id uuid references bingo_sections(id) on delete cascade;
update bingo_tasks
   set section_id = (select id from bingo_sections where slug = 'default')
 where section_id is null;
alter table bingo_tasks alter column section_id set not null;
create index if not exists bingo_tasks_section_idx on bingo_tasks (section_id);

-- bingo_teams.section_id
alter table bingo_teams add column if not exists section_id uuid references bingo_sections(id) on delete cascade;
update bingo_teams
   set section_id = (select id from bingo_sections where slug = 'default')
 where section_id is null;
alter table bingo_teams alter column section_id set not null;
create index if not exists bingo_teams_section_idx on bingo_teams (section_id);

-- bingo_settings.active_section_id (which section is live for players)
alter table bingo_settings add column if not exists active_section_id uuid references bingo_sections(id);
update bingo_settings
   set active_section_id = (select id from bingo_sections where slug = 'default')
 where active_section_id is null;

-- RLS: match the permissive pattern used by the other bingo_* tables.
alter table bingo_sections enable row level security;
drop policy if exists "anon read bingo_sections"  on bingo_sections;
drop policy if exists "anon write bingo_sections" on bingo_sections;
create policy "anon read bingo_sections"  on bingo_sections for select using (true);
create policy "anon write bingo_sections" on bingo_sections for all    using (true) with check (true);

-- Tell PostgREST to reload so the new table/columns become visible immediately.
notify pgrst, 'reload schema';
