-- Migration: Add points column to tasks table
-- Run this in the Supabase SQL Editor

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points int NOT NULL DEFAULT 0;
