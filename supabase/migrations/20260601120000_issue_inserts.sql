/*
  # Issue inserts (full-page image adverts)

  One row per 1-page advert placed inside an issue. Ordered together with the
  issue's articles via a shared sort_order line (normalised on reorder in the app).
  `kind` is reserved for future PDF adverts; for now only 'image' is used.

  Run this ONCE in the Supabase SQL editor. Permissive anon policy (MVP, single-user;
  tighten for production). The CREATE POLICY statement is not idempotent — if it
  already exists on re-run, ignore the "already exists" error.
*/

CREATE TABLE IF NOT EXISTS mag_pdf_issue_inserts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES mag_pdf_categories(id) ON DELETE CASCADE,
  image_url text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'image',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mag_pdf_issue_inserts_category
  ON mag_pdf_issue_inserts(category_id, sort_order);

ALTER TABLE mag_pdf_issue_inserts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mag_pdf anon all issue_inserts"
  ON mag_pdf_issue_inserts FOR ALL TO anon USING (true) WITH CHECK (true);
