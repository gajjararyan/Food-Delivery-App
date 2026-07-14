-- Public kitchen / dish photos (chefs upload from the app; customers read URLs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kitchen-photos',
  'kitchen-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kitchen_photos_public_read" on storage.objects;
create policy "kitchen_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'kitchen-photos');

drop policy if exists "kitchen_photos_anon_insert" on storage.objects;
create policy "kitchen_photos_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'kitchen-photos');

drop policy if exists "kitchen_photos_anon_update" on storage.objects;
create policy "kitchen_photos_anon_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'kitchen-photos')
  with check (bucket_id = 'kitchen-photos');

drop policy if exists "kitchen_photos_anon_delete" on storage.objects;
create policy "kitchen_photos_anon_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'kitchen-photos');
