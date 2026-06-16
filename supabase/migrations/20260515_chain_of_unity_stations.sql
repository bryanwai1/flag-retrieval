-- Chain of Unity stations: per-session activity cards with images.
-- Each station is an editable card (title, body, image) with its own QR.
-- Participants scan a station QR to read its instructions.
--
-- Run AFTER 20260514_chain_of_unity.sql in the same Supabase project.
-- Idempotent — safe to re-run.

create table if not exists chain_stations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chain_sessions(id) on delete cascade,
  position    int  not null default 0,
  title       text not null,
  body        text,
  image_url   text,
  code        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists chain_stations_session_idx on chain_stations (session_id, position);

create table if not exists chain_station_scans (
  id          uuid primary key default gen_random_uuid(),
  station_id  uuid not null references chain_stations(id) on delete cascade,
  group_id    uuid references chain_groups(id) on delete set null,
  scanner_id  text,
  scanned_at  timestamptz not null default now()
);
create index if not exists chain_station_scans_station_idx on chain_station_scans (station_id);
create index if not exists chain_station_scans_group_idx   on chain_station_scans (group_id);

-- Permissive RLS — matches the rest of this anon-keyed event app.
alter table chain_stations      enable row level security;
alter table chain_station_scans enable row level security;

drop policy if exists "anon rw chain_stations"      on chain_stations;
drop policy if exists "anon rw chain_station_scans" on chain_station_scans;

create policy "anon rw chain_stations"      on chain_stations      for all using (true) with check (true);
create policy "anon rw chain_station_scans" on chain_station_scans for all using (true) with check (true);

-- updated_at trigger so admin edits bump the timestamp.
create or replace function chain_stations_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists chain_stations_updated_at on chain_stations;
create trigger chain_stations_updated_at
  before update on chain_stations
  for each row execute function chain_stations_set_updated_at();

-- Realtime: surface station + station-scan changes to subscribed clients.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chain_stations'
  ) then
    execute 'alter publication supabase_realtime add table public.chain_stations';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chain_station_scans'
  ) then
    execute 'alter publication supabase_realtime add table public.chain_station_scans';
  end if;
end $$;

-- Public storage bucket for station images.
insert into storage.buckets (id, name, public)
values ('chain-station-images', 'chain-station-images', true)
on conflict (id) do nothing;

drop policy if exists "anon read chain_station_images"  on storage.objects;
drop policy if exists "anon write chain_station_images" on storage.objects;

create policy "anon read chain_station_images"
  on storage.objects for select
  using (bucket_id = 'chain-station-images');

create policy "anon write chain_station_images"
  on storage.objects for all
  using (bucket_id = 'chain-station-images')
  with check (bucket_id = 'chain-station-images');

notify pgrst, 'reload schema';
