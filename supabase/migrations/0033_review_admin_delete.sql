-- Reviews: only the admin deletes (client decision, questions.md №22).
-- The old "review owner write" policy was FOR ALL, which let the author
-- delete their own review; split it so owners can still write and edit their
-- review, but deletion is staff-only.

drop policy if exists "review owner write" on reviews;

-- Guarded so a pre-tracking database with these already present doesn't trip
-- the migration runner's duplicate-object handling mid-file.
drop policy if exists "review owner insert" on reviews;
create policy "review owner insert" on reviews
  for insert with check (user_id = auth.uid());
drop policy if exists "review owner update" on reviews;
create policy "review owner update" on reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "review staff delete" on reviews;
create policy "review staff delete" on reviews
  for delete using (is_staff());
