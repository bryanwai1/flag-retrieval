-- Bingo Dash: prevent duplicate member sign-ups.
--
-- Problem: bingo_members had NO uniqueness on (section_id, name). The app
-- de-duplicated members purely client-side via ilike(name), which fails when a
-- player re-enters their name slightly differently, when a transient error pushes
-- them back to the join screen, or when two devices race — so the same person ends
-- up with several rows (inflating team rosters and the 4-member cap). Once two
-- duplicates existed, the client lookup (.maybeSingle()) errored on the multi-row
-- result and inserted YET another row, compounding the problem.
--
-- This (1) merges existing duplicates, keeping the most recently created row per
-- person, then (2) adds a case-insensitive unique index on (section_id, lower(name)).
-- App code (BingoDashJoin.joinGroup) now upserts against this and recovers from a
-- unique-violation (23505) by reusing the existing row instead of creating a new one.
--
-- Run once in the Supabase SQL editor.

-- 1. Remove duplicate members, keeping the newest row per (section_id, lower(name)).
--    bingo_scans are keyed by team_id, not member_id, so deleting redundant member
--    rows does NOT affect scoring or completed tiles — only the roster/cap counts.
delete from bingo_members m
using bingo_members keep
where keep.section_id = m.section_id
  and lower(keep.name) = lower(m.name)
  and (
    keep.created_at > m.created_at
    or (keep.created_at = m.created_at and keep.id > m.id)
  );

-- 2. Enforce one member per name per board, case-insensitively.
create unique index if not exists bingo_members_section_lower_name_key
  on bingo_members (section_id, lower(name));

-- Reload PostgREST so the schema change is picked up immediately.
notify pgrst, 'reload schema';
