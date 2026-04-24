-- Event-day performance indexes.
-- Target: 50 concurrent users on Supabase Pro tier.
-- Speeds up leaderboard queries, bingo scan dedup, and shape results ordering.
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

-- ── team_scans (flag retrieval leaderboard, highest frequency) ──
create index if not exists idx_team_scans_completed
  on team_scans (completed);

create index if not exists idx_team_scans_completed_team
  on team_scans (completed, team_id);

create index if not exists idx_team_scans_scanned_at
  on team_scans (scanned_at);

create index if not exists idx_team_scans_team_task
  on team_scans (team_id, task_id);

-- ── bingo_scans (bingo leaderboard + per-team views) ──
create index if not exists idx_bingo_scans_team_id
  on bingo_scans (team_id);

create index if not exists idx_bingo_scans_team_task
  on bingo_scans (team_id, task_id);

-- ── shape_results (shape game leaderboard + round filtering) ──
create index if not exists idx_shape_results_completion_time
  on shape_results (completion_time);

create index if not exists idx_shape_results_round_id
  on shape_results (round_id);

-- Reload PostgREST schema cache.
notify pgrst, 'reload schema';
