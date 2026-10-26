-- PassVault profile photos: isolated private Storage bucket, no changes to vault tables.
-- Apply once using Supabase SQL Editor or the normal Supabase migration workflow.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passvault-avatars', 'passvault-avatars', false, 262144, array['image/webp'])
on conflict (id) do update set public=false, file_size_limit=262144, allowed_mime_types=array['image/webp'];

-- Each account may access only its own folder: <auth.uid()>/avatar.webp.
create policy "pv_avatar_select_own" on storage.objects
for select to authenticated
using (bucket_id='passvault-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "pv_avatar_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id='passvault-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "pv_avatar_update_own" on storage.objects
for update to authenticated
using (bucket_id='passvault-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id='passvault-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "pv_avatar_delete_own" on storage.objects
for delete to authenticated
using (bucket_id='passvault-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
