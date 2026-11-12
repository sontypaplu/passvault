-- Security hardening: permits only the existing single WebP avatar per user.
-- Apply AFTER 004_private_profile_avatars.sql. No vault or crypto schema change.
-- Remove the previously permissive folder-only policies.
drop policy if exists "pv_avatar_select_own" on storage.objects;
drop policy if exists "pv_avatar_insert_own" on storage.objects;
drop policy if exists "pv_avatar_update_own" on storage.objects;
drop policy if exists "pv_avatar_delete_own" on storage.objects;

create policy "pv_avatar_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'passvault-avatars' and name = (select auth.uid()::text) || '/avatar.webp');

create policy "pv_avatar_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'passvault-avatars' and name = (select auth.uid()::text) || '/avatar.webp');

create policy "pv_avatar_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'passvault-avatars' and name = (select auth.uid()::text) || '/avatar.webp')
with check (bucket_id = 'passvault-avatars' and name = (select auth.uid()::text) || '/avatar.webp');

create policy "pv_avatar_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'passvault-avatars' and name = (select auth.uid()::text) || '/avatar.webp');
