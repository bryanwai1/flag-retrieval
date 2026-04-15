-- ============================================================
-- Bingo Dash — Supabase migration
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Bingo tasks (the challenge cards)
CREATE TABLE IF NOT EXISTS bingo_tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'Blue',
  hex_code   TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Instruction pages with 6 pointers (same shape as task_pages)
CREATE TABLE IF NOT EXISTS bingo_task_pages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES bingo_tasks(id) ON DELETE CASCADE,
  page_order INTEGER NOT NULL DEFAULT 0,
  media_url  TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  pointer_1  TEXT, pointer_2 TEXT, pointer_3 TEXT,
  pointer_4  TEXT, pointer_5 TEXT, pointer_6 TEXT,
  example_1  TEXT, example_2 TEXT, example_3 TEXT,
  example_4  TEXT, example_5 TEXT, example_6 TEXT,
  icon_1     TEXT, icon_2    TEXT, icon_3    TEXT,
  icon_4     TEXT, icon_5    TEXT, icon_6    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Hero photos for each card
CREATE TABLE IF NOT EXISTS bingo_task_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES bingo_tasks(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  photo_order INTEGER NOT NULL DEFAULT 0,
  position_x  NUMERIC NOT NULL DEFAULT 50,
  position_y  NUMERIC NOT NULL DEFAULT 50,
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bingo Dash teams (own registration, no tribe system)
CREATE TABLE IF NOT EXISTS bingo_teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Scan + completion records
CREATE TABLE IF NOT EXISTS bingo_scans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES bingo_teams(id) ON DELETE CASCADE,
  task_id      UUID NOT NULL REFERENCES bingo_tasks(id) ON DELETE CASCADE,
  scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (team_id, task_id)
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE bingo_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_task_pages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_scans       ENABLE ROW LEVEL SECURITY;

-- Allow full anon access (same pattern as existing tables)
CREATE POLICY "anon read bingo_tasks"        ON bingo_tasks       FOR SELECT USING (true);
CREATE POLICY "anon write bingo_tasks"       ON bingo_tasks       FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "anon read bingo_task_pages"   ON bingo_task_pages  FOR SELECT USING (true);
CREATE POLICY "anon write bingo_task_pages"  ON bingo_task_pages  FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "anon read bingo_task_photos"  ON bingo_task_photos FOR SELECT USING (true);
CREATE POLICY "anon write bingo_task_photos" ON bingo_task_photos FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "anon read bingo_teams"        ON bingo_teams       FOR SELECT USING (true);
CREATE POLICY "anon write bingo_teams"       ON bingo_teams       FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "anon read bingo_scans"        ON bingo_scans       FOR SELECT USING (true);
CREATE POLICY "anon write bingo_scans"       ON bingo_scans       FOR ALL    USING (true) WITH CHECK (true);
