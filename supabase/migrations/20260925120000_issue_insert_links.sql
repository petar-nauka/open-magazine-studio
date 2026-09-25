/*
  # Link on full-page adverts (issue inserts)

  A full-page advert placed between articles can now lead somewhere when
  clicked, in the preview and in the exported PDF (the page becomes an <a>).
  NULL = no link. Set from the issue page, next to each advert.

  (Adverts and images *inside* an article already keep their link in
  mag_pdf_content_blocks.metadata.href, so they need no migration.)

  Run once in the Supabase SQL editor. Idempotent.
*/

ALTER TABLE mag_pdf_issue_inserts
  ADD COLUMN IF NOT EXISTS link_url text;

-- PostgREST caches the schema; without this the new column is invisible to the API.
NOTIFY pgrst, 'reload schema';
