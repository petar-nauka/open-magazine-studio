import { supabase } from './supabase';
import { articleFromParsed, type ArticleDoc } from './document-model';
import type { ContentBlock, ParsedArticle } from './paste-parser';

export interface ArticleRow {
  title: string;
  author: string | null;
  layout_config: { accent?: string } | null;
}

export interface BlockRow {
  id: string;
  type: ContentBlock['type'];
  content: string;
  position: number;
  metadata: ContentBlock['metadata'] | null;
}

// Pure mapper: DB rows -> ArticleDoc. Kept separate so it can be unit-tested
// without a live Supabase connection.
export function rowsToArticleDoc(article: ArticleRow, blocks: BlockRow[]): ArticleDoc {
  const parsed: ParsedArticle = {
    title: article.title,
    blocks: blocks
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((b) => ({
        id: b.id,
        type: b.type,
        content: b.content,
        position: b.position,
        metadata: b.metadata ?? {},
      })),
  };
  return articleFromParsed(parsed, {
    author: article.author ?? '',
    accent: article.layout_config?.accent ?? 'teal',
  });
}

export async function loadArticleDoc(id: string): Promise<ArticleDoc> {
  const [articleRes, blocksRes] = await Promise.all([
    supabase.from('mag_pdf_articles').select('title, author, layout_config').eq('id', id).maybeSingle(),
    supabase
      .from('mag_pdf_content_blocks')
      .select('id, type, content, position, metadata')
      .eq('article_id', id)
      .order('position'),
  ]);
  if (articleRes.error) throw articleRes.error;
  if (!articleRes.data) throw new Error(`Article not found: ${id}`);
  return rowsToArticleDoc(articleRes.data as ArticleRow, (blocksRes.data ?? []) as BlockRow[]);
}
