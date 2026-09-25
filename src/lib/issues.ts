import { supabase } from './supabase';

export interface Issue {
  id: string;
  name: string;
  issue_number: number | null;
  cover_image_url: string;
  cover_pdf_url?: string;
  created_at: string;
  archived_at?: string | null; // set = hidden from the home page, listed under "Архив"
}

const ISSUE_LIST_COLUMNS = 'id, name, issue_number, cover_image_url, created_at, archived_at';
export interface IssueArticle { id: string; title: string; sort_order: number; }

export function nextSortOrder(items: { sort_order: number }[]): number {
  return items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
}


export const ISSUES_PAGE_SIZE = 20;

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), totalPages);
}

// Page buttons to draw: first, last and the neighbours of the current page,
// with 'gap' where pages are skipped. A single skipped page is shown instead
// of a gap, since "…" would take the same room.
export function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  const pages = [...new Set([1, current - 1, current, current + 1, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((p, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) out.push('gap');
    out.push(p);
  });
  return out;
}

// Home page URL state: which tab (active issues or the archive) and which page.
// Defaults are left out so the first active page stays a bare "/".
export function issuesSearch({ archived, page }: { archived: boolean; page: number }): Record<string, string> {
  return {
    ...(archived ? { view: 'archive' } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  };
}

// Only this ever filters on archived_at, so the list and its counts can't disagree.
function onlyArchived<Q extends { is(c: string, v: null): Q; not(c: string, op: string, v: null): Q }>(q: Q, archived: boolean): Q {
  return archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
}

export async function countIssues(archived: boolean): Promise<number> {
  const { count, error } = await onlyArchived(
    supabase.from('mag_pdf_categories').select('id', { count: 'exact', head: true }), archived);
  if (error) throw error;
  return count ?? 0;
}

// One page of active or archived issues, newest first. `page` is 1-based.
// created_at is a tie-breaker so rows without an issue_number keep a stable
// place across pages.
export async function loadIssuesPage(page: number, archived = false, pageSize = ISSUES_PAGE_SIZE): Promise<{ issues: Issue[]; total: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count, status } = await onlyArchived(
    supabase.from('mag_pdf_categories').select(ISSUE_LIST_COLUMNS, { count: 'exact' }), archived)
    .order('issue_number', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (status === 416) {
    // Page past the end (stale link, issues deleted): PostgREST answers 416 with
    // no count, so fetch the count alone and let the caller clamp. Checked by
    // status, not error.code — this stack returns a mangled body with no code.
    return { issues: [], total: await countIssues(archived) };
  }
  if (error) throw error; // let the caller show an error state instead of a silent empty list
  return { issues: (data ?? []) as Issue[], total: count ?? 0 };
}

// Archiving only hides the issue from the home page; its articles and inserts
// are untouched, and passing false brings it back.
export async function setIssueArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('mag_pdf_categories')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function createIssue(name: string): Promise<Issue> {
  const { data: maxRows } = await supabase
    .from('mag_pdf_categories').select('issue_number').order('issue_number', { ascending: false }).limit(1);
  const nextNum = (maxRows?.[0]?.issue_number ?? 0) + 1;
  const { data, error } = await supabase
    .from('mag_pdf_categories').insert({ name, issue_number: nextNum }).select('*').maybeSingle();
  if (error || !data) throw error ?? new Error('createIssue failed');
  return data as Issue;
}

export async function loadIssue(id: string): Promise<{ issue: Issue; articles: IssueArticle[] }> {
  const [issueRes, articlesRes] = await Promise.all([
    supabase.from('mag_pdf_categories').select('*').eq('id', id).maybeSingle(),
    supabase.from('mag_pdf_articles').select('id, title, sort_order').eq('category_id', id).order('sort_order'),
  ]);
  if (!issueRes.data) throw new Error('Issue not found');
  return { issue: issueRes.data as Issue, articles: (articlesRes.data ?? []) as IssueArticle[] };
}

export async function setIssueCover(id: string, field: 'cover_image_url' | 'cover_pdf_url', dataUrl: string): Promise<void> {
  const { error } = await supabase.from('mag_pdf_categories').update({ [field]: dataUrl }).eq('id', id);
  if (error) throw error;
}

export async function loadAllIssues(): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('mag_pdf_categories')
    .select(ISSUE_LIST_COLUMNS)
    .order('issue_number', { ascending: false, nullsFirst: false });
  if (error) throw error; // surfaced by the caller's catch instead of a silent empty list
  return (data ?? []) as Issue[];
}

// Detach an article from its issue without deleting it: it stays in the system
// (visible under "Без категория") and can be re-added to any issue later.
export async function archiveArticleFromIssue(articleId: string): Promise<void> {
  const { error } = await supabase
    .from('mag_pdf_articles')
    .update({ category_id: null, updated_at: new Date().toISOString() })
    .eq('id', articleId);
  if (error) throw error;
}

// Deep-copy an article (row + all its content blocks) into another issue. The
// original stays untouched; the copy lands at the end of the target issue.
export async function duplicateArticleToIssue(articleId: string, targetCategoryId: string): Promise<void> {
  const [articleRes, blocksRes, targetRes] = await Promise.all([
    supabase.from('mag_pdf_articles').select('title, author, layout_config, status, tags').eq('id', articleId).maybeSingle(),
    supabase.from('mag_pdf_content_blocks').select('type, content, position, metadata').eq('article_id', articleId).order('position'),
    supabase.from('mag_pdf_articles').select('sort_order').eq('category_id', targetCategoryId),
  ]);
  if (articleRes.error || !articleRes.data) throw articleRes.error ?? new Error('Изходната статия не е намерена');
  const src = articleRes.data;

  const { data: newArticle, error: insErr } = await supabase
    .from('mag_pdf_articles')
    .insert({
      title: src.title,
      author: src.author,
      layout_config: src.layout_config,
      status: src.status ?? 'draft',
      tags: src.tags,
      category_id: targetCategoryId,
      sort_order: nextSortOrder(targetRes.data ?? []),
    })
    .select('id')
    .maybeSingle();
  if (insErr || !newArticle) throw insErr ?? new Error('Дублирането се провали');

  const blocks = (blocksRes.data ?? []).map((b) => ({ article_id: newArticle.id, ...b }));
  if (blocks.length) {
    const { error: blkErr } = await supabase.from('mag_pdf_content_blocks').insert(blocks);
    if (blkErr) throw blkErr;
  }
}
