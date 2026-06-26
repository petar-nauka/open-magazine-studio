import { supabase } from './supabase';
import type { ContentBlock } from './paste-parser';

// Persist an article's blocks by replacing them wholesale: delete the existing
// rows, then insert the current editor state. This is what actually saves block
// edits (image sizes, text, spans, spacers, ad settings) — the article row alone
// never holds them. Block ids are DB-generated, so we don't carry them across
// (editor-added blocks have non-uuid ids); positions are re-indexed so the stored
// order always matches the editor. Throws on any error so the caller can surface
// the failure instead of falsely reporting "saved".
export async function replaceArticleBlocks(articleId: string, blocks: ContentBlock[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('mag_pdf_content_blocks')
    .delete()
    .eq('article_id', articleId);
  if (deleteError) throw deleteError;

  if (blocks.length === 0) return;

  const rows = blocks.map((b, i) => ({
    article_id: articleId,
    type: b.type,
    content: b.content,
    position: i,
    metadata: b.metadata,
  }));
  const { error: insertError } = await supabase.from('mag_pdf_content_blocks').insert(rows);
  if (insertError) throw insertError;
}
