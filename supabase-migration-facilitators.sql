-- Migration: Shape Sequence facilitator system
-- Run in Supabase SQL Editor

-- 1. Add accepting_submissions flag to shape_rounds
ALTER TABLE shape_rounds ADD COLUMN IF NOT EXISTS accepting_submissions boolean NOT NULL DEFAULT false;

-- 2. Facilitators table
CREATE TABLE IF NOT EXISTS shape_facilitators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL UNIQUE,
  facilitator_num integer,
  created_at timestamptz DEFAULT now()
);

-- Add facilitator_num to existing table if upgrading
ALTER TABLE shape_facilitators ADD COLUMN IF NOT EXISTS facilitator_num integer;

CREATE INDEX IF NOT EXISTS idx_shape_facilitators_group ON shape_facilitators(group_name);

ALTER PUBLICATION supabase_realtime ADD TABLE shape_facilitators;
