-- Migration: Add team_members table
-- Run this in the Supabase SQL Editor

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  is_creator boolean not null default false,
  joined_at timestamptz default now()
);

create index idx_team_members_team on team_members(team_id);

alter publication supabase_realtime add table team_members;
