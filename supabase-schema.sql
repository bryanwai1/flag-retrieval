-- Flag Retrieval: Supabase Schema
-- Run this in the Supabase SQL Editor

-- Tasks: each colored card
create table tasks (
  id uuid primary key default gen_random_uuid(),
  color text not null,
  hex_code text not null,
  title text not null,
  sort_order int not null default 0,
  points int not null default 0,
  created_at timestamptz default now()
);

-- Task pages: ordered instruction pages per task
create table task_pages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  page_order int not null default 0,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  pointer_1 text,
  pointer_2 text,
  pointer_3 text,
  pointer_4 text,
  pointer_5 text,
  pointer_6 text,
  example_1 text,
  example_2 text,
  example_3 text,
  example_4 text,
  example_5 text,
  example_6 text,
  icon_1 text,
  icon_2 text,
  icon_3 text,
  icon_4 text,
  icon_5 text,
  icon_6 text,
  created_at timestamptz default now()
);

-- Teams: self-registered
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Team scans: tracks which team scanned which task
create table team_scans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  scanned_at timestamptz default now(),
  completed boolean not null default false,
  completed_at timestamptz,
  unique(team_id, task_id)
);

-- Task photos: clue photo gallery per task (up to 10)
create table task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  photo_url text not null,
  photo_order int not null default 0,
  position_x float not null default 50,
  position_y float not null default 50,
  created_at timestamptz default now()
);

-- Indexes
create index idx_task_photos_task_id on task_photos(task_id, photo_order);
create index idx_task_pages_task_id on task_pages(task_id, page_order);
create index idx_team_scans_team on team_scans(team_id);
create index idx_team_scans_task on team_scans(task_id);

-- Enable realtime
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table team_scans;
alter publication supabase_realtime add table tasks;
