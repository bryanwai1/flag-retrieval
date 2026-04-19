-- ── Bingo Dash: Award slides config (per compartment) ───────────────────────
-- Run once in the Supabase SQL editor.
--
-- Stores the ceremony layout for the Award Slides show:
--   · total_points         — total prize-pool value shown on the holding slide
--   · image_url            — hero image shown on the holding / intro slides
--   · consolation_count    — how many "Honorable Mention" slides to include
--   · third_count          — how many 2nd Runner-Up slides
--   · second_count         — how many 1st Runner-Up slides
--   · first_count          — how many Grand Champion slides
--   · slide_order          — ordered JSON array of slide ids (e.g.
--                            ["intro","holding","consolation:0",...,"first:0"])
--   · slide_points         — per-slide prize points, keyed by slide id
--                            (e.g. {"first:0": 1000, "second:0": 500})

CREATE TABLE IF NOT EXISTS bingo_award_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL UNIQUE REFERENCES bingo_sections(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  consolation_count INTEGER NOT NULL DEFAULT 3,
  third_count INTEGER NOT NULL DEFAULT 1,
  second_count INTEGER NOT NULL DEFAULT 1,
  first_count INTEGER NOT NULL DEFAULT 1,
  slide_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  slide_points JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already existed from an earlier run, add the new column.
ALTER TABLE bingo_award_configs
  ADD COLUMN IF NOT EXISTS slide_points JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE bingo_award_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "award_configs_all" ON bingo_award_configs;
CREATE POLICY "award_configs_all" ON bingo_award_configs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS bingo_award_configs_section_idx
  ON bingo_award_configs (section_id);

-- Tell PostgREST to reload so the new table is visible immediately.
notify pgrst, 'reload schema';
