-- Add password column to teams table
-- Run this in the Supabase SQL editor for the "Flag Retrieval" project

ALTER TABLE teams ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT '';
