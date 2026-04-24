-- Relax RLS on shape_rounds, shape_results, and bingo_challenge_sections
-- to match the tasks-rls-relax / bingo_sections pattern.
--
-- The /admin route has no login gate, so anon-key writes are used for all
-- admin operations. The original authenticated-only policies blocked admin
-- features (round control, results edit/delete, challenge section CRUD).
--
-- Run once in the Supabase SQL editor.

-- ── shape_rounds ─────────────────────────────────────────────
alter table shape_rounds enable row level security;

drop policy if exists "shape_rounds: public read"   on shape_rounds;
drop policy if exists "shape_rounds: admin write"   on shape_rounds;
drop policy if exists "shape_rounds: admin update"  on shape_rounds;
drop policy if exists "shape_rounds: admin delete"  on shape_rounds;
drop policy if exists "shape_rounds: public write"  on shape_rounds;
drop policy if exists "shape_rounds: public update" on shape_rounds;
drop policy if exists "shape_rounds: public delete" on shape_rounds;

create policy "shape_rounds: public read"   on shape_rounds for select using (true);
create policy "shape_rounds: public write"  on shape_rounds for insert with check (true);
create policy "shape_rounds: public update" on shape_rounds for update using (true) with check (true);
create policy "shape_rounds: public delete" on shape_rounds for delete using (true);

-- ── shape_results ────────────────────────────────────────────
alter table shape_results enable row level security;

drop policy if exists "shape_results: public read"        on shape_results;
drop policy if exists "shape_results: facilitator submit" on shape_results;
drop policy if exists "shape_results: admin update"       on shape_results;
drop policy if exists "shape_results: admin delete"       on shape_results;
drop policy if exists "shape_results: public write"       on shape_results;
drop policy if exists "shape_results: public update"      on shape_results;
drop policy if exists "shape_results: public delete"      on shape_results;

create policy "shape_results: public read"   on shape_results for select using (true);
create policy "shape_results: public write"  on shape_results for insert with check (true);
create policy "shape_results: public update" on shape_results for update using (true) with check (true);
create policy "shape_results: public delete" on shape_results for delete using (true);

-- ── bingo_challenge_sections ─────────────────────────────────
-- Table was created manually in Supabase (no migration on disk).
-- Apply the same permissive pattern used by bingo_sections and other bingo_* tables.
alter table bingo_challenge_sections enable row level security;

drop policy if exists "anon read bingo_challenge_sections"  on bingo_challenge_sections;
drop policy if exists "anon write bingo_challenge_sections" on bingo_challenge_sections;

create policy "anon read bingo_challenge_sections"
  on bingo_challenge_sections for select using (true);
create policy "anon write bingo_challenge_sections"
  on bingo_challenge_sections for all using (true) with check (true);

-- Reload PostgREST schema cache so policy changes take effect immediately.
notify pgrst, 'reload schema';
