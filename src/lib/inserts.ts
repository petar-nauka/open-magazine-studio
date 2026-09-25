import { supabase } from './supabase';

export interface IssueInsert { id: string; image_url: string; sort_order: number; kind: string; link_url?: string | null; }

export interface IssueItem {
  kind: 'article' | 'insert';
  id: string;
  sort_order: number;
  title?: string;      // article
  image_url?: string;  // insert
  link_url?: string | null; // insert: where a click on the advert leads
}

// Pure merge of articles + inserts into one list ordered by sort_order.
// Stable tie-break: on equal sort_order an article comes before an insert.
export function mergeIssueItems(
  articles: { id: string; title: string; sort_order: number }[],
  inserts: IssueInsert[],
): IssueItem[] {
  const items: IssueItem[] = [
    ...articles.map((a) => ({ kind: 'article' as const, id: a.id, sort_order: a.sort_order, title: a.title })),
    ...inserts.map((i) => ({ kind: 'insert' as const, id: i.id, sort_order: i.sort_order, image_url: i.image_url, link_url: i.link_url })),
  ];
  return items.sort(
    (a, b) => a.sort_order - b.sort_order || (a.kind === b.kind ? 0 : a.kind === 'article' ? -1 : 1),
  );
}

export async function loadInserts(issueId: string): Promise<IssueInsert[]> {
  const { data, error } = await supabase
    .from('mag_pdf_issue_inserts')
    .select('id, image_url, sort_order, kind, link_url')
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

// null removes the link. The value is expected to be normalised already (normalizeHref).
export async function setInsertLink(id: string, linkUrl: string | null): Promise<void> {
  const { error } = await supabase.from('mag_pdf_issue_inserts').update({ link_url: linkUrl }).eq('id', id);
  if (error) throw error;
}

export async function deleteInsert(id: string): Promise<void> {
  const { error } = await supabase.from('mag_pdf_issue_inserts').delete().eq('id', id);
  if (error) throw error;
}

// Pure: move an item to position `toIndex` (0 = first) of the merged order —
// what a drag-and-drop does — then renumber the whole list densely (0..n).
// Robust to duplicate/zero sort_order (articles are created with the DB default
// 0). An out-of-range target is clamped. Returns the same array reference on a
// no-op (same place, unknown id).
export function moveItemTo(items: IssueItem[], id: string, toIndex: number): IssueItem[] {
  const sorted = [...items].sort(
    (a, b) => a.sort_order - b.sort_order || (a.kind === b.kind ? 0 : a.kind === 'article' ? -1 : 1),
  );
  const from = sorted.findIndex((i) => i.id === id);
  const to = Math.max(0, Math.min(sorted.length - 1, toIndex));
  if (from < 0 || from === to) return items;
  const [moved] = sorted.splice(from, 1);
  sorted.splice(to, 0, moved);
  return sorted.map((it, i) => ({ ...it, sort_order: i }));
}

// One step up/down: the arrow buttons. Same no-op contract as moveItemTo.
export function moveItem(items: IssueItem[], id: string, dir: 'up' | 'down'): IssueItem[] {
  const idx = [...items].sort(
    (a, b) => a.sort_order - b.sort_order || (a.kind === b.kind ? 0 : a.kind === 'article' ? -1 : 1),
  ).findIndex((i) => i.id === id);
  const target = dir === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || target < 0 || target >= items.length) return items;
  return moveItemTo(items, id, target);
}

// Write an already-reordered, densely renumbered list (from moveItem/moveItemTo)
// back to its two tables. Prefers a single transactional RPC so a mid-way failure
// can't leave the issue half-renumbered; falls back to per-row updates when the
// function isn't deployed yet (PGRST202) — same pattern as replaceArticleBlocks.
export async function saveIssueOrder(reordered: IssueItem[]): Promise<void> {
  const articles = reordered.filter((it) => it.kind === 'article').map((it) => ({ id: it.id, sort_order: it.sort_order }));
  const inserts = reordered.filter((it) => it.kind === 'insert').map((it) => ({ id: it.id, sort_order: it.sort_order }));

  const { error: rpcError } = await supabase.rpc('mag_pdf_reorder_issue_items', {
    p_articles: articles,
    p_inserts: inserts,
  });
  if (!rpcError) return;

  const functionMissing =
    rpcError.code === 'PGRST202' || /could not find the function|does not exist/i.test(rpcError.message);
  if (!functionMissing) throw rpcError;

  // Fallback (pre-migration): non-transactional per-row updates.
  await Promise.all(
    reordered.map(async (it) => {
      const { error } = it.kind === 'article'
        ? await supabase.from('mag_pdf_articles').update({ sort_order: it.sort_order }).eq('id', it.id)
        : await supabase.from('mag_pdf_issue_inserts').update({ sort_order: it.sort_order }).eq('id', it.id);
      if (error) throw error;
    }),
  );
}
