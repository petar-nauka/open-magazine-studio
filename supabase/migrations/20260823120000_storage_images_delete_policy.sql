/*
  # Delete policy for the article-images bucket

  The media library (Библиотека) lets the user remove images that are not used
  anywhere, to reclaim Storage. `20260531130000_storage_images_bucket.sql` only
  granted anon SELECT and INSERT, so every delete failed — and it failed
  SILENTLY: the Storage API answers `HTTP 200 []` when RLS removes nothing, so
  the client saw success while the file stayed. This adds the missing policy.

  The client still guards the result count (see deleteImages in
  src/lib/media-library.ts), so a future policy change can never bring the silent
  no-op back.

  Run this ONCE in the Supabase SQL editor. Not idempotent — if the policy
  already exists, ignore the "already exists" error.
*/

create policy "mag_pdf_images anon delete"
  on storage.objects for delete to anon
  using (bucket_id = 'mag_pdf_images');
