/*
  # Transactional block replacement for an article

  save-blocks.ts previously did DELETE all blocks + INSERT the new ones as two
  separate requests. If the INSERT failed (network, size limit, bad row) the
  article was left with ZERO blocks — silent content loss.

  This function does the delete + insert inside a single PL/pgSQL call, which
  runs in one transaction: if the insert raises, the delete is rolled back and
  the article keeps its previous blocks.

  Security: SECURITY INVOKER, so the existing MVP RLS policy ("anon FOR ALL")
  still governs the delete/insert. EXECUTE is granted to anon (and
  authenticated) so the single-user app can call it with the anon key.

  p_blocks is a JSON array of { type, content, position, metadata } objects
  (article_id is taken from p_article_id, ids are DB-generated).
*/

CREATE OR REPLACE FUNCTION mag_pdf_replace_article_blocks(
  p_article_id uuid,
  p_blocks jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM mag_pdf_content_blocks WHERE article_id = p_article_id;

  INSERT INTO mag_pdf_content_blocks (article_id, type, content, position, metadata)
  SELECT
    p_article_id,
    b->>'type',
    COALESCE(b->>'content', ''),
    COALESCE((b->>'position')::int, (ord - 1)::int),
    COALESCE(b->'metadata', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_blocks, '[]'::jsonb)) WITH ORDINALITY AS t(b, ord);
END;
$$;

GRANT EXECUTE ON FUNCTION mag_pdf_replace_article_blocks(uuid, jsonb) TO anon, authenticated;
