import { supabase } from './supabase';

// Library of every image already uploaded to Storage, annotated with where each
// one is used. There is no media table: names and "tags" are DERIVED from the
// articles and issues that reference an image, so the library can never drift
// out of sync with reality. The usage map is also what makes deletion safe —
// picking an image from the library does NOT copy it, so two articles can share
// one file and deleting it would break both.

const BUCKET = 'mag_pdf_images';
// Only `img/` is library material. `cover/` holds cover PDFs uploaded verbatim
// (uploadRawFile), which are not pickable images.
const PREFIX = 'img';
// Diagnostic stubs a few bytes long were left in the bucket by earlier smoke
// tests; they are not real images.
const MIN_SIZE_BYTES = 100;

export type UsageKind =
  | 'article-image'
  | 'article-ad'
  | 'article-cover'
  | 'issue-cover'
  | 'issue-ad';

const KIND_LABEL: Record<UsageKind, string> = {
  'article-image': 'Снимка в текста',
  'article-ad': 'Реклама в статия',
  'article-cover': 'Корица на статия',
  'issue-cover': 'Корица на броя',
  'issue-ad': 'Рекламна страница',
};

export interface Usage {
  kind: UsageKind;
  articleId?: string;
  articleTitle?: string;
  issueId?: string;
  issueLabel?: string;
}

export interface LibraryImage {
  path: string; // 'img/<uuid>.jpg'
  url: string;
  createdAt: string;
  size: number;
  usages: Usage[]; // empty = safe to delete
}

// Shapes as returned by Storage / PostgREST, kept narrow so buildLibrary stays pure.
export interface StorageObject {
  name: string; // relative to PREFIX
  created_at: string;
  metadata: { size: number; mimetype?: string } | null;
}

export interface BlockRow { content: string; type: string; article_id: string | null }
export interface ArticleRow { id: string; title: string; category_id: string | null; layout_config: { openerImage?: string } | null }
export interface CategoryRow { id: string; name: string; issue_number: number | null; cover_image_url: string | null }
export interface InsertRow { image_url: string; category_id: string | null }

export interface UsageSources {
  blocks: BlockRow[];
  articles: ArticleRow[];
  categories: CategoryRow[];
  inserts: InsertRow[];
}

export function publicUrlForPath(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Storage can resize on the fly (imgproxy sits behind /render/image), which turns
// a ~107 KB photo into a ~5 KB thumbnail. With 350+ images in the grid that is
// the difference between 21 MB and 2 MB. Callers fall back to the full URL if the
// render endpoint ever fails.
export function thumbUrl(path: string, width = 240): string {
  const full = publicUrlForPath(path);
  return full.replace('/object/public/', '/render/image/public/') + `?width=${width}&quality=60`;
}

// Maps a stored URL back to its Storage path. Returns null for anything that is
// not in our bucket — external images (nauka.bg) and leftover base64 blocks —
// so those references are simply dropped instead of inventing library entries.
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const rest = url.slice(i + marker.length).split('?')[0];
  return rest || null;
}

function issueLabelOf(cat: CategoryRow | undefined): string | undefined {
  if (!cat) return undefined;
  return cat.issue_number ? `Брой ${cat.issue_number} · ${cat.name}` : cat.name;
}

export function buildLibrary(objects: StorageObject[], sources: UsageSources): LibraryImage[] {
  const byId = new Map(sources.articles.map((a) => [a.id, a]));
  const catById = new Map(sources.categories.map((c) => [c.id, c]));

  // path -> usages, de-duplicated: the same image repeated inside one article
  // (or listed by two sources) is one usage, not several.
  const usages = new Map<string, Usage[]>();
  const seen = new Set<string>();
  const add = (url: string | null | undefined, usage: Usage) => {
    if (!url) return;
    const path = pathFromPublicUrl(url);
    if (!path) return;
    const key = `${path}|${usage.kind}|${usage.articleId ?? ''}|${usage.issueId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = usages.get(path) ?? [];
    list.push(usage);
    usages.set(path, list);
  };

  for (const b of sources.blocks) {
    if (b.type !== 'image' && b.type !== 'ad') continue;
    const article = b.article_id ? byId.get(b.article_id) : undefined;
    if (!article) continue; // orphaned block (article deleted) — not a real usage
    add(b.content, {
      kind: b.type === 'ad' ? 'article-ad' : 'article-image',
      articleId: article.id,
      articleTitle: article.title,
      issueId: article.category_id ?? undefined,
      issueLabel: issueLabelOf(article.category_id ? catById.get(article.category_id) : undefined),
    });
  }

  for (const a of sources.articles) {
    add(a.layout_config?.openerImage, {
      kind: 'article-cover',
      articleId: a.id,
      articleTitle: a.title,
      issueId: a.category_id ?? undefined,
      issueLabel: issueLabelOf(a.category_id ? catById.get(a.category_id) : undefined),
    });
  }

  for (const c of sources.categories) {
    add(c.cover_image_url, { kind: 'issue-cover', issueId: c.id, issueLabel: issueLabelOf(c) });
  }

  for (const ins of sources.inserts) {
    const cat = ins.category_id ? catById.get(ins.category_id) : undefined;
    add(ins.image_url, { kind: 'issue-ad', issueId: ins.category_id ?? undefined, issueLabel: issueLabelOf(cat) });
  }

  return objects
    .filter((o) => (o.metadata?.mimetype ?? '').startsWith('image/'))
    .filter((o) => (o.metadata?.size ?? 0) >= MIN_SIZE_BYTES)
    .map((o) => {
      const path = `${PREFIX}/${o.name}`;
      return {
        path,
        url: publicUrlForPath(path),
        createdAt: o.created_at,
        size: o.metadata?.size ?? 0,
        usages: usages.get(path) ?? [],
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// The one-line caption under a thumbnail: where this image comes from.
export function imageLabel(img: LibraryImage): string {
  if (img.usages.length === 0) return 'Неползвана';
  const first = img.usages[0];
  const parts = [first.issueLabel, first.articleTitle].filter(Boolean);
  const head = parts.length ? parts.join(' · ') : (KIND_LABEL[first.kind] ?? 'Ползвана');
  return img.usages.length > 1 ? `${head} (+${img.usages.length - 1})` : head;
}

// Every place this image appears — shown when a delete is refused.
export function usageLines(img: LibraryImage): string[] {
  return img.usages.map((u) => {
    const where = [u.issueLabel, u.articleTitle].filter(Boolean).join(' · ');
    return where ? `${KIND_LABEL[u.kind]} — ${where}` : KIND_LABEL[u.kind];
  });
}

export function isDeletable(img: LibraryImage): boolean {
  return img.usages.length === 0;
}

export function unusedImages(images: LibraryImage[]): LibraryImage[] {
  return images.filter(isDeletable);
}

export function totalSize(images: LibraryImage[]): number {
  return images.reduce((sum, i) => sum + i.size, 0);
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// --- data access -----------------------------------------------------------

const PAGE = 1000;

async function listAllObjects(): Promise<StorageObject[]> {
  const out: StorageObject[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(PREFIX, { limit: PAGE, offset, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    const page = (data ?? []) as unknown as StorageObject[];
    out.push(...page);
    // Keep paging until a short page comes back, so the library never silently
    // truncates once the bucket grows past one page.
    if (page.length < PAGE) return out;
  }
}

export async function loadLibrary(): Promise<LibraryImage[]> {
  // Four flat queries joined in JS rather than PostgREST embeds: the data is
  // small (hundreds of rows), and it keeps the join pure and unit-tested.
  const [objects, blocks, articles, categories, inserts] = await Promise.all([
    listAllObjects(),
    supabase.from('mag_pdf_content_blocks').select('content, type, article_id').in('type', ['image', 'ad']),
    supabase.from('mag_pdf_articles').select('id, title, category_id, layout_config'),
    supabase.from('mag_pdf_categories').select('id, name, issue_number, cover_image_url'),
    supabase.from('mag_pdf_issue_inserts').select('image_url, category_id'),
  ]);

  if (blocks.error) throw blocks.error;
  if (articles.error) throw articles.error;
  if (categories.error) throw categories.error;

  return buildLibrary(objects, {
    blocks: (blocks.data ?? []) as BlockRow[],
    articles: (articles.data ?? []) as ArticleRow[],
    categories: (categories.data ?? []) as CategoryRow[],
    // Inserts degrade gracefully: an older DB without the migration still shows
    // a library, it just can't mark full-page ads as used.
    inserts: inserts.error ? [] : ((inserts.data ?? []) as InsertRow[]),
  });
}

export async function deleteImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
  // Storage answers `HTTP 200 []` when RLS silently removes nothing, so a
  // missing delete policy looks exactly like success. Compare what came back
  // against what we asked for, otherwise "изтрити 151" would be a lie.
  const removed = data?.length ?? 0;
  if (removed < paths.length) {
    throw new Error(
      `Изтрити са ${removed} от ${paths.length} файла. Липсва DELETE политика за bucket-а ` +
      `(migration 20260823120000_storage_images_delete_policy.sql).`
    );
  }
}
