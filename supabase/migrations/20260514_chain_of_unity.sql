-- Chain of Unity: 8-station "bound crew" team event.
-- Admin pre-creates groups (each gets a unique QR code). Participants scan to
-- record a join, then see the 6 rules of the chain. Admin sees live scan counts.
--
-- Run in the Supabase SQL editor (or via supabase db push).

create table if not exists chain_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Chain of Unity',
  event_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists chain_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chain_sessions(id) on delete cascade,
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists chain_groups_session_idx on chain_groups (session_id);

create table if not exists chain_scans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references chain_groups(id) on delete cascade,
  scanner_id text,
  scanned_at timestamptz not null default now()
);
create index if not exists chain_scans_group_idx on chain_scans (group_id);

-- Permissive RLS — matches the rest of this anon-keyed event app.
alter table chain_sessions enable row level security;
alter table chain_groups   enable row level security;
alter table chain_scans    enable row level security;

drop policy if exists "anon rw chain_sessions" on chain_sessions;
drop policy if exists "anon rw chain_groups"   on chain_groups;
drop policy if exists "anon rw chain_scans"    on chain_scans;

create policy "anon rw chain_sessions" on chain_sessions for all using (true) with check (true);
create policy "anon rw chain_groups"   on chain_groups   for all using (true) with check (true);
create policy "anon rw chain_scans"    on chain_scans    for all using (true) with check (true);

-- Realtime: live scan counts on the admin dashboard need chain_scans in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chain_scans'
  ) then
    execute 'alter publication supabase_realtime add table public.chain_scans';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chain_groups'
  ) then
    execute 'alter publication supabase_realtime add table public.chain_groups';
  end if;
end $$;

notify pgrst, 'reload schema';
