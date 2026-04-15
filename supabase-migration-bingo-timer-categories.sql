-- ── Bingo Dash: Timer + Categories ──────────────────────────────────────────
-- Run this in the Supabase SQL editor

-- 1. Add category column to bingo_tasks (default empty string)
ALTER TABLE bingo_tasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';

-- 2. Create bingo_settings table (single-row config)
CREATE TABLE IF NOT EXISTS bingo_settings (
  id           TEXT PRIMARY KEY DEFAULT 'main',
  timer_seconds INTEGER NOT NULL DEFAULT 0,
  timer_end_at  TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the default row if it doesn't exist
INSERT INTO bingo_settings (id, timer_seconds, timer_end_at)
VALUES ('main', 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Row-level security
ALTER TABLE bingo_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bingo_settings' AND policyname = 'allow_all_bingo_settings'
  ) THEN
    CREATE POLICY allow_all_bingo_settings ON bingo_settings
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
