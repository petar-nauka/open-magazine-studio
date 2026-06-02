/* Add a PDF-cover column to issues (image cover already lives in cover_image_url).
   Run once in the Supabase SQL editor. */
ALTER TABLE mag_pdf_categories
  ADD COLUMN IF NOT EXISTS cover_pdf_url text DEFAULT '';
