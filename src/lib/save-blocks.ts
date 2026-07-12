import { supabase } from './supabase';
import type { ContentBlock } from './paste-parser';

// Persist an article's blocks by replacing them wholesale. This is what actually
// saves block edits (image sizes, text, spans, spacers, ad settings) — the
// article row alone never holds them. Block ids are DB-generated, so we don't
// carry them across (editor-added blocks have non-uuid ids); positions are
// re-indexed so the stored order always matches the editor. Throws on any error
// so the caller can surface the failure instead of falsely reporting "saved".
//
// Preferred path: a single transactional RPC (mag_pdf_replace_article_blocks)
// that does delete+insert atomically, so a failed insert can't leave the article
// with zero blocks. If that function isn't deployed yet, we fall back to the
// old two-request delete+insert — so the app keeps working before the migration
// is applied, and upgrades automatically once it is.
export async function replaceArticleBlocks(articleId: string, blocks: ContentBlock[]): Promise<void> {
  const payload = blocks.map((b, i) => ({
    type: b.type,
    content: b.content,
    position: i,
    metadata: b.metadata,
  }));

  const { error: rpcError } = await supabase.rpc('mag_pdf_replace_article_blocks', {
    p_article_id: articleId,
    p_blocks: payload,
  });
  if (!rpcError) return;

  // PostgREST reports a missing function as PGRST202 (not in the schema cache).
  // Only then fall back; any other RPC error is a real failure and must surface.
  const functionMissing =
    rpcError.code === 'PGRST202' || /could not find the function|does not exist/i.test(rpcError.message);
  if (!functionMissing) throw rpcError;

  // Fallback (pre-migration): non-transactional delete + insert.
  const { error: deleteError } = await supabase
    .from('mag_pdf_content_blocks')
    .delete()
    .eq('article_id', articleId);
  if (deleteError) throw deleteError;

  if (payload.length === 0) return;

  const rows = payload.map((r) => ({ ...r, article_id: articleId }));
  const { error: insertError } = await supabase.from('mag_pdf_content_blocks').insert(rows);
  if (insertError) throw insertError;
}
