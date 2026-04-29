-- Allow public DELETE on bingo_photo_submissions so the admin UI can remove
-- submission rows (per-submission Del button, bulk delete, and per-team Reset).
-- Existing policies (SELECT/INSERT/UPDATE) are already public; this matches them.

drop policy if exists "public delete photo submissions" on bingo_photo_submissions;
create policy "public delete photo submissions" on bingo_photo_submissions
  for delete using (true);
