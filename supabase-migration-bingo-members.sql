-- Bingo members: individual participants who belong to a group (team)
CREATE TABLE IF NOT EXISTS bingo_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES bingo_teams(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES bingo_sections(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bingo_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read bingo_members"  ON bingo_members FOR SELECT USING (true);
CREATE POLICY "anon write bingo_members" ON bingo_members FOR ALL    USING (true) WITH CHECK (true);
