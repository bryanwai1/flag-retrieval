-- Relax RLS on tasks and related admin tables to match bingo_tasks pattern.
-- The /admin route has no login gate, so the authenticated-only INSERT/UPDATE/DELETE
-- policies blocked all task creation from the admin dashboard (silent 401).

drop policy if exists "tasks: admin write"  on tasks;
drop policy if exists "tasks: admin update" on tasks;
drop policy if exists "tasks: admin delete" on tasks;

create policy "tasks: public write"  on tasks for insert with check (true);
create policy "tasks: public update" on tasks for update using (true) with check (true);
create policy "tasks: public delete" on tasks for delete using (true);

drop policy if exists "task_pages: admin write"  on task_pages;
drop policy if exists "task_pages: admin update" on task_pages;
drop policy if exists "task_pages: admin delete" on task_pages;

create policy "task_pages: public write"  on task_pages for insert with check (true);
create policy "task_pages: public update" on task_pages for update using (true) with check (true);
create policy "task_pages: public delete" on task_pages for delete using (true);

drop policy if exists "task_photos: admin write"  on task_photos;
drop policy if exists "task_photos: admin update" on task_photos;
drop policy if exists "task_photos: admin delete" on task_photos;

create policy "task_photos: public write"  on task_photos for insert with check (true);
create policy "task_photos: public update" on task_photos for update using (true) with check (true);
create policy "task_photos: public delete" on task_photos for delete using (true);
