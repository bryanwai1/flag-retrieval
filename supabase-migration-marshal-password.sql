-- Global marshal password (shared across all tasks)
ALTER TABLE bingo_settings ADD COLUMN IF NOT EXISTS marshal_password TEXT NOT NULL DEFAULT '1234';

-- Per-task toggle: require marshal password to complete (default ON)
ALTER TABLE bingo_tasks ADD COLUMN IF NOT EXISTS require_marshal BOOLEAN NOT NULL DEFAULT TRUE;
