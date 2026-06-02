import { supabase } from './supabase';

export interface IssueInsert { id: string; image_url: string; sort_order: number; kind: string; }

export interface IssueItem {
  kind: 'article' | 'insert';
  id: string;
  sort_order: number;
  title?: string;      // article
  image_url?: string;  // insert
}

// Pure merge of articles + inserts into one list ordered by sort_order.
// Stable tie-break: on equal sort_order an article comes before an insert.
export function mergeIssueItems(
  articles: { id: string; title: string; sort_order: number }[],
  inserts: IssueInsert[],
): IssueItem[] {
  const items: IssueItem[] = [
    ...articles.map((a) => ({ kind: 'article' as const, id: a.id, sort_order: a.sort_order, title: a.title })),
    ...inserts.map((i) => ({ kind: 'insert' as const, id: i.id, sort_order: i.sort_order, image_url: i.image_url })),
  ];
  return items.sort(
    (a, b) => a.sort_order - b.sort_order || (a.kind === b.kind ? 0 : a.kind === 'article' ? -1 : 1),
  );
}

export async function loadInserts(issueId: string): Promise<IssueInsert[]> {
  const { data, error } = await supabase
    .from('mag_pdf_issue_inserts')
    .select('id, image_url, sort_order, kind')
    .eq('category_id', issueId)
    .order('sort_order');
  if (error) {
    // Degrade gracefully (e.g. the mag_pdf_issue_inserts migration hasn't been run yet)
    // so issues without ads still load; ads simply won't appear until the table exists.
    console.warn('Could not load issue inserts (is the mag_pdf_issue_inserts migration applied?)', error);
    return [];
  }
  return (data ?? []) as IssueInsert[];
}

export async function addInsert(issueId: string, imageUrl: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('mag_pdf_issue_inserts')
    .insert({ category_id: issueId, image_url: imageUrl, sort_order: sortOrder });
  if (error) throw error;
}

export async function deleteInsert(id: string): Promise<void> {
  const { error } = await supabase.from('mag_pdf_issue_inserts').delete().eq('id', id);
  if (error) throw error;
}

// Pure: move an item one step up/down within the merged order, then renumber the
// whole list densely (0..n). Robust to duplicate/zero sort_order (articles are
// created with the DB default 0). Returns the same array reference on a no-op
// (moving the first item up / last item down).
export function moveItem(items: IssueItem[], id: string, dir: 'up' | 'down'): IssueItem[] {
  const sorted = [...items].sort(
    (a, b) => a.sort_order - b.sort_order || (a.kind === b.kind ? 0 : a.kind === 'article' ? -1 : 1),
  );
  const idx = sorted.findIndex((i) => i.id === id);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return items;
  [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
  return sorted.map((it, i) => ({ ...it, sort_order: i }));
}

// Reorder the unified list (positional move + dense renumber) and write each item
// back to its table.
export async function reorderIssueItems(items: IssueItem[], id: string, dir: 'up' | 'down'): Promise<void> {
  const reordered = moveItem(items, id, dir);
  if (reordered === items) return; // no-op at the ends
  await Promise.all(
    reordered.map(async (it) => {
      const { error } = it.kind === 'article'
        ? await supabase.from('mag_pdf_articles').update({ sort_order: it.sort_order }).eq('id', it.id)
        : await supabase.from('mag_pdf_issue_inserts').update({ sort_order: it.sort_order }).eq('id', it.id);
      if (error) throw error;
    }),
  );
}
