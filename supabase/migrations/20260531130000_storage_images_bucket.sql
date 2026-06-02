/*
  # Storage bucket for article images

  Article images are compressed client-side and uploaded here instead of being
  stored as base64 in the DB (which made rows exceed the server request-size limit).

  Run this ONCE in the Supabase SQL editor. Creates a public bucket and permissive
  anon read/insert policies (MVP, single-user; tighten for production).

  Note: the CREATE POLICY statements are not idempotent — if you re-run and they
  already exist, ignore the "already exists" error.
*/

insert into storage.buckets (id, name, public)
values ('mag_pdf_images', 'mag_pdf_images', true)
on conflict (id) do update set public = true;

create policy "mag_pdf_images anon read"
  on storage.objects for select to anon
  using (bucket_id = 'mag_pdf_images');

create policy "mag_pdf_images anon insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'mag_pdf_images');
