import { supabase } from './supabase';
import { rowsToArticleDoc, type ArticleRow, type BlockRow } from './load-article';
import type { ArticleDoc } from './document-model';
import { loadInserts, mergeIssueItems, type IssueInsert } from './inserts';

interface IssueArticleRow extends ArticleRow { id: string; sort_order: number; }

export type RenderItem =
  | { kind: 'article'; id: string; doc: ArticleDoc }
  | { kind: 'insert'; id: string; imageUrl: string };

// Pure: build the ordered render sequence (articles interleaved with image inserts).
export function buildRenderItems(
  articles: IssueArticleRow[],
  blocksByArticle: Record<string, BlockRow[]>,
  inserts: IssueInsert[],
): RenderItem[] {
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const merged = mergeIssueItems(
    articles.map((a) => ({ id: a.id, title: a.title, sort_order: a.sort_order })),
    inserts,
  );
  return merged.map((it): RenderItem => {
    if (it.kind === 'insert') return { kind: 'insert', id: it.id, imageUrl: it.image_url ?? '' };
    const a = articleById.get(it.id);
    if (!a) throw new Error(`Article row missing for ${it.id}`);
    return { kind: 'article', id: it.id, doc: rowsToArticleDoc(a, blocksByArticle[it.id] ?? []) };
  });
}

// Retained for unit tests (and possible single-article export); the app now uses buildRenderItems.
export function issueRowsToDocs(
  articles: IssueArticleRow[],
  blocksByArticle: Record<string, BlockRow[]>
): ArticleDoc[] {
  return [...articles]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => rowsToArticleDoc(a, blocksByArticle[a.id] ?? []));
}

export async function loadIssueDoc(issueId: string): Promise<{ coverImage: string; items: RenderItem[] }> {
  const issueRes = await supabase
    .from('mag_pdf_categories').select('cover_image_url').eq('id', issueId).maybeSingle();
  const articlesRes = await supabase
    .from('mag_pdf_articles').select('id, title, author, layout_config, sort_order').eq('category_id', issueId).order('sort_order');
  const articles = (articlesRes.data ?? []) as IssueArticleRow[];
  const blocksByArticle: Record<string, BlockRow[]> = {};
  await Promise.all(
    articles.map(async (a) => {
      const r = await supabase
        .from('mag_pdf_content_blocks').select('id, type, content, position, metadata').eq('article_id', a.id).order('position');
      blocksByArticle[a.id] = (r.data ?? []) as BlockRow[];
    }),
  );
  const inserts = await loadInserts(issueId);
  return {
    coverImage: (issueRes.data?.cover_image_url as string) || '',
    items: buildRenderItems(articles, blocksByArticle, inserts),
  };
}
