-- Bingo Dash: make team (group) names unique PER BOARD, not globally.
--
-- The original bingo-dash migration declared `bingo_teams.name TEXT NOT NULL UNIQUE`,
-- a GLOBAL unique constraint. After boards (sections) were added, that constraint
-- meant two different boards could not both have a group with the same name
-- (e.g. both wanting "Group 1") — teams from one board clashed with another.
--
-- This drops the global constraint and replaces it with a per-section one, mirroring
-- the (section_id, name) pattern already used by bingo_categories. App code already
-- checks name uniqueness per section, so this only relaxes the DB to match.
--
-- Run once in the Supabase SQL editor.

-- 1. Drop the legacy global UNIQUE(name) constraint (default name: bingo_teams_name_key).
alter table bingo_teams drop constraint if exists bingo_teams_name_key;

-- 2. Names need only be unique within a single board/section.
alter table bingo_teams drop constraint if exists bingo_teams_section_id_name_key;
alter table bingo_teams add  constraint bingo_teams_section_id_name_key unique (section_id, name);

-- Reload PostgREST so the schema change is picked up immediately.
notify pgrst, 'reload schema';
