-- =============================================================
-- Flag Retrieval: Row Level Security (RLS) Policies
-- Run this in the Supabase SQL Editor (once only).
--
-- Model:
--   anon key  → participant operations (read tasks, register team, record scan)
--   auth user → all admin operations (create/update/delete anything)
-- =============================================================

-- ── tasks ────────────────────────────────────────────────────
alter table tasks enable row level security;

create policy "tasks: public read"
  on tasks for select using (true);

create policy "tasks: admin write"
  on tasks for insert with check (auth.role() = 'authenticated');

create policy "tasks: admin update"
  on tasks for update using (auth.role() = 'authenticated');

create policy "tasks: admin delete"
  on tasks for delete using (auth.role() = 'authenticated');

-- ── task_pages ───────────────────────────────────────────────
alter table task_pages enable row level security;

create policy "task_pages: public read"
  on task_pages for select using (true);

create policy "task_pages: admin write"
  on task_pages for insert with check (auth.role() = 'authenticated');

create policy "task_pages: admin update"
  on task_pages for update using (auth.role() = 'authenticated');

create policy "task_pages: admin delete"
  on task_pages for delete using (auth.role() = 'authenticated');

-- ── teams ────────────────────────────────────────────────────
alter table teams enable row level security;

create policy "teams: public read"
  on teams for select using (true);

create policy "teams: public register"
  on teams for insert with check (true);

create policy "teams: admin update"
  on teams for update using (auth.role() = 'authenticated');

create policy "teams: admin delete"
  on teams for delete using (auth.role() = 'authenticated');

-- ── team_members ─────────────────────────────────────────────
alter table team_members enable row level security;

create policy "team_members: public read"
  on team_members for select using (true);

create policy "team_members: public join"
  on team_members for insert with check (true);

create policy "team_members: admin update"
  on team_members for update using (auth.role() = 'authenticated');

create policy "team_members: admin delete"
  on team_members for delete using (auth.role() = 'authenticated');

-- ── team_scans ───────────────────────────────────────────────
alter table team_scans enable row level security;

create policy "team_scans: public read"
  on team_scans for select using (true);

create policy "team_scans: participant record"
  on team_scans for insert with check (true);

-- upsert is INSERT + UPDATE; allow public upsert for scan recording
create policy "team_scans: participant upsert update"
  on team_scans for update using (true) with check (
    -- only allow updating scanned_at; completed/completed_at require admin
    auth.role() = 'authenticated'
    or (completed = false and completed_at is null)
  );

create policy "team_scans: admin delete"
  on team_scans for delete using (auth.role() = 'authenticated');

-- ── shape_rounds ─────────────────────────────────────────────
alter table shape_rounds enable row level security;

create policy "shape_rounds: public read"
  on shape_rounds for select using (true);

create policy "shape_rounds: admin write"
  on shape_rounds for insert with check (auth.role() = 'authenticated');

create policy "shape_rounds: admin update"
  on shape_rounds for update using (auth.role() = 'authenticated');

create policy "shape_rounds: admin delete"
  on shape_rounds for delete using (auth.role() = 'authenticated');

-- ── shape_results ────────────────────────────────────────────
alter table shape_results enable row level security;

create policy "shape_results: public read"
  on shape_results for select using (true);

-- Facilitators submit results without being logged in
create policy "shape_results: facilitator submit"
  on shape_results for insert with check (true);

create policy "shape_results: admin update"
  on shape_results for update using (auth.role() = 'authenticated');

create policy "shape_results: admin delete"
  on shape_results for delete using (auth.role() = 'authenticated');

-- ── task_photos ──────────────────────────────────────────────
alter table task_photos enable row level security;

create policy "task_photos: public read"
  on task_photos for select using (true);

create policy "task_photos: admin write"
  on task_photos for insert with check (auth.role() = 'authenticated');

create policy "task_photos: admin update"
  on task_photos for update using (auth.role() = 'authenticated');

create policy "task_photos: admin delete"
  on task_photos for delete using (auth.role() = 'authenticated');

-- ── shape_facilitators ───────────────────────────────────────
alter table shape_facilitators enable row level security;

create policy "shape_facilitators: public read"
  on shape_facilitators for select using (true);

create policy "shape_facilitators: facilitator register"
  on shape_facilitators for insert with check (true);

create policy "shape_facilitators: admin delete"
  on shape_facilitators for delete using (auth.role() = 'authenticated');
