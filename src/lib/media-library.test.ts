import { describe, it, expect } from 'vitest';
import {
  pathFromPublicUrl,
  publicUrlForPath,
  buildLibrary,
  imageLabel,
  usageLines,
  isDeletable,
  thumbUrl,
  unusedImages,
  type StorageObject,
  type UsageSources,
} from './media-library';

const BASE = 'https://example.supabase.co/storage/v1/object/public/mag_pdf_images/';

const obj = (name: string, createdAt = '2026-08-01T10:00:00Z', size = 1000): StorageObject => ({
  name,
  created_at: createdAt,
  metadata: { size, mimetype: 'image/jpeg' },
});

const emptySources: UsageSources = { blocks: [], articles: [], categories: [], inserts: [] };

describe('pathFromPublicUrl', () => {
  it('extracts the storage path from a public URL', () => {
    expect(pathFromPublicUrl(`${BASE}img/abc.jpg`)).toBe('img/abc.jpg');
  });

  it('strips a query string (cache-busting params)', () => {
    expect(pathFromPublicUrl(`${BASE}img/abc.jpg?t=123`)).toBe('img/abc.jpg');
  });

  it('returns null for an external image URL', () => {
    expect(pathFromPublicUrl('https://nauka.bg/wp-content/uploads/2026/08/sn.jpg')).toBeNull();
  });

  it('returns null for a base64 data URL', () => {
    expect(pathFromPublicUrl('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
  });

  it('returns null for an empty tail', () => {
    expect(pathFromPublicUrl(BASE)).toBeNull();
  });

  it('round-trips with publicUrlForPath', () => {
    expect(pathFromPublicUrl(publicUrlForPath('img/x.jpg'))).toBe('img/x.jpg');
  });
});

describe('thumbUrl', () => {
  it('points at the resizing endpoint instead of the raw object', () => {
    const t = thumbUrl('img/a.jpg', 240);
    expect(t).toContain('/render/image/public/mag_pdf_images/img/a.jpg');
    expect(t).toContain('width=240');
    expect(t).not.toContain('/object/public/');
  });
});

describe('buildLibrary — usage joining', () => {
  it('marks an image used in an article body, with its issue', () => {
    const sources: UsageSources = {
      blocks: [{ content: `${BASE}img/a.jpg`, type: 'image', article_id: 'art1' }],
      articles: [{ id: 'art1', title: 'Ядрена безопасност', category_id: 'iss1', layout_config: {} }],
      categories: [{ id: 'iss1', name: 'АВГУСТ 2026', issue_number: 5, cover_image_url: null }],
      inserts: [],
    };
    const [img] = buildLibrary([obj('a.jpg')], sources);
    expect(img.usages).toHaveLength(1);
    expect(img.usages[0]).toMatchObject({
      kind: 'article-image',
      articleTitle: 'Ядрена безопасност',
      issueLabel: 'Брой 5 · АВГУСТ 2026',
    });
  });

  it('distinguishes an ad block from a body image', () => {
    const sources: UsageSources = {
      ...emptySources,
      blocks: [{ content: `${BASE}img/a.jpg`, type: 'ad', article_id: 'art1' }],
      articles: [{ id: 'art1', title: 'Статия', category_id: null, layout_config: {} }],
    };
    const [img] = buildLibrary([obj('a.jpg')], sources);
    expect(img.usages[0].kind).toBe('article-ad');
  });

  it('picks up an article cover from layout_config.openerImage', () => {
    const sources: UsageSources = {
      ...emptySources,
      articles: [{ id: 'a1', title: 'Статия', category_id: null, layout_config: { openerImage: `${BASE}img/c.jpg` } }],
    };
    const [img] = buildLibrary([obj('c.jpg')], sources);
    expect(img.usages[0].kind).toBe('article-cover');
  });

  it('picks up an issue cover', () => {
    const sources: UsageSources = {
      ...emptySources,
      categories: [{ id: 'i1', name: 'ЮЛИ 2026', issue_number: 4, cover_image_url: `${BASE}img/k.jpg` }],
    };
    const [img] = buildLibrary([obj('k.jpg')], sources);
    expect(img.usages[0]).toMatchObject({ kind: 'issue-cover', issueLabel: 'Брой 4 · ЮЛИ 2026' });
  });

  it('picks up a full-page ad insert', () => {
    const sources: UsageSources = {
      ...emptySources,
      categories: [{ id: 'i1', name: 'ЮНИ', issue_number: 2, cover_image_url: null }],
      inserts: [{ image_url: `${BASE}img/ad.jpg`, category_id: 'i1' }],
    };
    const [img] = buildLibrary([obj('ad.jpg')], sources);
    expect(img.usages[0]).toMatchObject({ kind: 'issue-ad', issueLabel: 'Брой 2 · ЮНИ' });
  });

  it('collects every usage when one image is reused', () => {
    const sources: UsageSources = {
      ...emptySources,
      blocks: [
        { content: `${BASE}img/a.jpg`, type: 'image', article_id: 'art1' },
        { content: `${BASE}img/a.jpg`, type: 'image', article_id: 'art2' },
      ],
      articles: [
        { id: 'art1', title: 'Първа', category_id: null, layout_config: {} },
        { id: 'art2', title: 'Втора', category_id: null, layout_config: {} },
      ],
    };
    const [img] = buildLibrary([obj('a.jpg')], sources);
    expect(img.usages.map((u) => u.articleTitle)).toEqual(['Първа', 'Втора']);
  });

  it('counts an image used twice in the SAME article once', () => {
    const sources: UsageSources = {
      ...emptySources,
      blocks: [
        { content: `${BASE}img/a.jpg`, type: 'image', article_id: 'art1' },
        { content: `${BASE}img/a.jpg`, type: 'image', article_id: 'art1' },
      ],
      articles: [{ id: 'art1', title: 'Една', category_id: null, layout_config: {} }],
    };
    const [img] = buildLibrary([obj('a.jpg')], sources);
    expect(img.usages).toHaveLength(1);
  });

  it('leaves an unreferenced object with no usages', () => {
    const [img] = buildLibrary([obj('orphan.jpg')], emptySources);
    expect(img.usages).toEqual([]);
  });

  it('silently drops usages pointing outside our bucket', () => {
    const sources: UsageSources = {
      ...emptySources,
      blocks: [{ content: 'https://nauka.bg/wp-content/uploads/sn.jpg', type: 'image', article_id: 'art1' }],
      articles: [{ id: 'art1', title: 'Статия', category_id: null, layout_config: {} }],
    };
    const lib = buildLibrary([obj('a.jpg')], sources);
    expect(lib).toHaveLength(1);
    expect(lib[0].usages).toEqual([]);
  });

  it('ignores a usage whose article row is missing', () => {
    const sources: UsageSources = {
      ...emptySources,
      blocks: [{ content: `${BASE}img/a.jpg`, type: 'image', article_id: 'gone' }],
    };
    const [img] = buildLibrary([obj('a.jpg')], sources);
    expect(img.usages).toEqual([]);
  });

  it('handles an issue with no number', () => {
    const sources: UsageSources = {
      ...emptySources,
      categories: [{ id: 'i1', name: 'Спец-брой', issue_number: null, cover_image_url: `${BASE}img/k.jpg` }],
    };
    const [img] = buildLibrary([obj('k.jpg')], sources);
    expect(img.usages[0].issueLabel).toBe('Спец-брой');
  });

  it('keeps only image files and skips PDFs', () => {
    const pdf: StorageObject = { name: 'k.pdf', created_at: '2026-08-01T10:00:00Z', metadata: { size: 10, mimetype: 'application/pdf' } };
    expect(buildLibrary([obj('a.jpg'), pdf], emptySources).map((i) => i.path)).toEqual(['img/a.jpg']);
  });

  it('skips the 12-byte diagnostic stubs', () => {
    expect(buildLibrary([obj('tiny.jpg', '2026-08-01T10:00:00Z', 12)], emptySources)).toEqual([]);
  });

  it('sorts newest first', () => {
    const lib = buildLibrary(
      [obj('old.jpg', '2026-01-01T00:00:00Z'), obj('new.jpg', '2026-08-01T00:00:00Z')],
      emptySources
    );
    expect(lib.map((i) => i.path)).toEqual(['img/new.jpg', 'img/old.jpg']);
  });
});

describe('imageLabel', () => {
  const withUsages = (usages: { articleTitle?: string; issueLabel?: string }[]) => ({
    path: 'img/a.jpg', url: 'u', createdAt: '2026-08-23T10:00:00Z', size: 1000,
    usages: usages.map((u) => ({ kind: 'article-image' as const, ...u })),
  });

  it('says "Неползвана" when there is no usage', () => {
    expect(imageLabel(withUsages([]))).toBe('Неползвана');
  });

  it('shows issue and article for a single usage', () => {
    expect(imageLabel(withUsages([{ issueLabel: 'Брой 5 · АВГУСТ', articleTitle: 'Ядрена безопасност' }])))
      .toBe('Брой 5 · АВГУСТ · Ядрена безопасност');
  });

  it('falls back to the article alone when it is in no issue', () => {
    expect(imageLabel(withUsages([{ articleTitle: 'Самостоятелна' }]))).toBe('Самостоятелна');
  });

  it('marks extra usages with a count', () => {
    expect(imageLabel(withUsages([{ articleTitle: 'Първа' }, { articleTitle: 'Втора' }, { articleTitle: 'Трета' }])))
      .toBe('Първа (+2)');
  });
});

describe('usageLines', () => {
  it('lists each usage in a readable form', () => {
    const img = {
      path: 'img/a.jpg', url: 'u', createdAt: '', size: 0,
      usages: [
        { kind: 'article-image' as const, issueLabel: 'Брой 5', articleTitle: 'Ядрена' },
        { kind: 'issue-cover' as const, issueLabel: 'Брой 4' },
      ],
    };
    expect(usageLines(img)).toEqual([
      'Снимка в текста — Брой 5 · Ядрена',
      'Корица на броя — Брой 4',
    ]);
  });
});

describe('isDeletable / unusedImages', () => {
  const mk = (path: string, used: boolean) => ({
    path, url: 'u', createdAt: '', size: 100,
    usages: used ? [{ kind: 'article-image' as const, articleTitle: 'А' }] : [],
  });

  it('allows deleting an unused image', () => {
    expect(isDeletable(mk('img/a.jpg', false))).toBe(true);
  });

  it('refuses to delete a used image', () => {
    expect(isDeletable(mk('img/b.jpg', true))).toBe(false);
  });

  it('unusedImages returns only the orphans', () => {
    const lib = [mk('img/a.jpg', false), mk('img/b.jpg', true), mk('img/c.jpg', false)];
    expect(unusedImages(lib).map((i) => i.path)).toEqual(['img/a.jpg', 'img/c.jpg']);
  });
});
