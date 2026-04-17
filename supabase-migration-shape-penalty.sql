-- Add penalty flag to shape_results so admins can mark a submitted time
-- as penalized (displayed with strikethrough/red on scoreboards).

alter table shape_results
  add column if not exists has_penalty boolean not null default false;
