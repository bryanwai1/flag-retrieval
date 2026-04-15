-- Bingo Dash: Categories as first-class entities (Compartment → Category → Card)
-- Run in the Supabase SQL editor.

-- 1. Create the table
create table if not exists bingo_categories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references bingo_sections(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (section_id, name)
);

-- 2. Seed from existing task category strings
insert into bingo_categories (section_id, name, sort_order)
select
  section_id,
  category,
  row_number() over (partition by section_id order by category) - 1 as sort_order
from (
  select distinct section_id, category
  from bingo_tasks
  where category is not null and category <> ''
) t
on conflict (section_id, name) do nothing;

-- 3. RLS (match the permissive pattern used by other bingo_* tables)
alter table bingo_categories enable row level security;
drop policy if exists "anon read bingo_categories"  on bingo_categories;
drop policy if exists "anon write bingo_categories" on bingo_categories;
create policy "anon read bingo_categories"  on bingo_categories for select using (true);
create policy "anon write bingo_categories" on bingo_categories for all    using (true) with check (true);

-- Tell PostgREST to reload so the new table becomes visible immediately.
notify pgrst, 'reload schema';
