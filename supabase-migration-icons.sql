-- Migration: Add icon columns to task_pages table
-- Run this in the Supabase SQL Editor

ALTER TABLE task_pages ADD COLUMN IF NOT EXISTS icon_1 text;
ALTER TABLE task_pages ADD COLUMN IF NOT EXISTS icon_2 text;
ALTER TABLE task_pages ADD COLUMN IF NOT EXISTS icon_3 text;
ALTER TABLE task_pages ADD COLUMN IF NOT EXISTS icon_4 text;
ALTER TABLE task_pages ADD COLUMN IF NOT EXISTS icon_5 text;
ALTER TABLE task_pages ADD COLUMN IF NOT EXISTS icon_6 text;
