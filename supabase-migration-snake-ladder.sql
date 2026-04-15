-- Snake and Ladder game
-- Run in the Supabase SQL editor.

-- Games (each row = one Snake & Ladder game instance)
create table if not exists snake_games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  snakes jsonb not null default '{"99":41,"95":75,"87":24,"64":60,"62":19,"56":53,"49":11,"16":6}'::jsonb,
  ladders jsonb not null default '{"4":14,"9":31,"21":42,"28":84,"36":44,"51":67,"71":91,"80":100}'::jsonb,
  created_at timestamptz not null default now()
);

-- Each tile 1-100 on a given game's board maps to a bingo_task
create table if not exists snake_tiles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references snake_games(id) on delete cascade,
  tile_number int not null check (tile_number between 1 and 100),
  task_id uuid references bingo_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (game_id, tile_number)
);
create index if not exists snake_tiles_game_idx on snake_tiles (game_id);

-- Teams (chess pieces) for each game
create table if not exists snake_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references snake_games(id) on delete cascade,
  name text not null,
  hex_code text not null default '#ef4444',
  emoji text default '♟',
  position int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists snake_teams_game_idx on snake_teams (game_id);

-- Settings (which game is active)
create table if not exists snake_settings (
  id text primary key default 'main' check (id = 'main'),
  active_game_id uuid references snake_games(id) on delete set null
);
insert into snake_settings (id) values ('main') on conflict (id) do nothing;

-- Ensure a 'snake-ladder' section exists in bingo_sections so it's a first-class library category.
insert into bingo_sections (name, slug, sort_order)
  values ('Snake and Ladder', 'snake-ladder', 100)
  on conflict (slug) do nothing;

-- RLS: match permissive pattern used by other tables.
alter table snake_games    enable row level security;
alter table snake_tiles    enable row level security;
alter table snake_teams    enable row level security;
alter table snake_settings enable row level security;

drop policy if exists "anon rw snake_games"    on snake_games;
drop policy if exists "anon rw snake_tiles"    on snake_tiles;
drop policy if exists "anon rw snake_teams"    on snake_teams;
drop policy if exists "anon rw snake_settings" on snake_settings;

create policy "anon rw snake_games"    on snake_games    for all using (true) with check (true);
create policy "anon rw snake_tiles"    on snake_tiles    for all using (true) with check (true);
create policy "anon rw snake_teams"    on snake_teams    for all using (true) with check (true);
create policy "anon rw snake_settings" on snake_settings for all using (true) with check (true);

notify pgrst, 'reload schema';
