/*
  # Magazine Studio schema — all tables prefixed with `mag_pdf_`

  Consolidated schema for the magazine tool. Use THIS migration on a fresh
  Supabase project. The three earlier migrations (which create UN-prefixed
  `articles` / `content_blocks` / `categories` / `app_settings`) are superseded
  by this file — do not run them alongside this one.

  Tables:
    - mag_pdf_categories     (magazine issues)
    - mag_pdf_articles       (articles; layout_config holds the full layout JSON)
    - mag_pdf_content_blocks (ordered blocks per article)
    - mag_pdf_app_settings   (key-value config: 'ai_config', 'branding_config', ...)

  Security (MVP): Row Level Security is ON, with permissive `anon` (no-auth)
  access on every table so the single-user app works with just the anon key.
  TODO before production: replace the anon policies with authenticated ones.
*/

-- Categories (issues) -------------------------------------------------------
CREATE TABLE IF NOT EXISTS mag_pdf_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  issue_number integer UNIQUE,
  description text DEFAULT '',
  cover_image_url text DEFAULT '',
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Articles ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mag_pdf_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text,
  author text,
  layout_config jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  category_id uuid REFERENCES mag_pdf_categories(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Content blocks ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mag_pdf_content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES mag_pdf_articles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- App settings (key-value) --------------------------------------------------
CREATE TABLE IF NOT EXISTS mag_pdf_app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mag_pdf_content_blocks_article_id ON mag_pdf_content_blocks(article_id);
CREATE INDEX IF NOT EXISTS idx_mag_pdf_content_blocks_position ON mag_pdf_content_blocks(article_id, position);
CREATE INDEX IF NOT EXISTS idx_mag_pdf_articles_category_id ON mag_pdf_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_mag_pdf_articles_tags ON mag_pdf_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_mag_pdf_articles_status ON mag_pdf_articles(status);

-- Row Level Security --------------------------------------------------------
ALTER TABLE mag_pdf_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE mag_pdf_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mag_pdf_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mag_pdf_app_settings ENABLE ROW LEVEL SECURITY;

-- MVP: permissive anon access (single-user, no login). Tighten for production.
CREATE POLICY "mag_pdf anon all categories"
  ON mag_pdf_categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mag_pdf anon all articles"
  ON mag_pdf_articles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mag_pdf anon all content_blocks"
  ON mag_pdf_content_blocks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "mag_pdf anon all app_settings"
  ON mag_pdf_app_settings FOR ALL TO anon USING (true) WITH CHECK (true);
