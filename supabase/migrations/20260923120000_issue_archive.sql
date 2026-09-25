/*
  # Archive for issues (броеве)

  An issue that was started but never finished can be sent to the archive: it
  disappears from the home page (Броеве) and is listed under its "Архив" tab
  instead. Nothing is deleted — the issue, its articles and inserts stay as they
  are, and "Върни от архива" brings it back. NULL = active.

  Separate from the unused `published_at`: archiving means "hide", not
  "published".

  Run once in the Supabase SQL editor. Idempotent.
*/

ALTER TABLE mag_pdf_categories
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- PostgREST caches the schema; without this the new column is invisible to the API.
NOTIFY pgrst, 'reload schema';
