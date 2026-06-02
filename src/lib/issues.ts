import { supabase } from './supabase';

export interface Issue {
  id: string;
  name: string;
  issue_number: number | null;
  cover_image_url: string;
  cover_pdf_url?: string;
  created_at: string;
}
export interface IssueArticle { id: string; title: string; sort_order: number; }

export function nextSortOrder(items: { sort_order: number }[]): number {
  return items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
}


export async function loadRecentIssues(limit = 5): Promise<Issue[]> {
  const { data } = await supabase
    .from('mag_pdf_categories')
    .select('id, name, issue_number, cover_image_url, created_at')
    .order('issue_number', { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as Issue[];
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
