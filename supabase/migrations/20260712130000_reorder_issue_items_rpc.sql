/*
  # Atomic reorder of an issue's items

  reorderIssueItems (inserts.ts) wrote each item's new sort_order with a separate
  UPDATE. If one failed mid-way, the issue was left half-renumbered — a scrambled
  order (no data loss, but confusing). This function renumbers articles and image
  inserts in a single PL/pgSQL call (one transaction), so a failure rolls the
  whole reorder back and the previous order is kept.

  Security: SECURITY INVOKER — the MVP "anon FOR ALL" RLS still applies. EXECUTE
  granted to anon/authenticated for the single-user app.

  p_articles / p_inserts are JSON arrays of { id, sort_order } objects.
*/

CREATE OR REPLACE FUNCTION mag_pdf_reorder_issue_items(
  p_articles jsonb,
  p_inserts jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE mag_pdf_articles a
     SET sort_order = (x->>'sort_order')::int
    FROM jsonb_array_elements(COALESCE(p_articles, '[]'::jsonb)) AS x
   WHERE a.id = (x->>'id')::uuid;

  UPDATE mag_pdf_issue_inserts i
     SET sort_order = (x->>'sort_order')::int
    FROM jsonb_array_elements(COALESCE(p_inserts, '[]'::jsonb)) AS x
   WHERE i.id = (x->>'id')::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION mag_pdf_reorder_issue_items(jsonb, jsonb) TO anon, authenticated;
