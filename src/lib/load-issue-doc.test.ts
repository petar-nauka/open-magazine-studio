import { describe, it, expect } from 'vitest';
import { buildRenderItems } from './load-issue-doc';
import type { BlockRow } from './load-article';

describe('buildRenderItems', () => {
  it('interleaves articles and inserts by sort_order, mapping each to a RenderItem', () => {
    const articles = [
      { id: 'a1', title: 'Първа', author: null, layout_config: { accent: 'teal' }, sort_order: 0 },
      { id: 'a2', title: 'Втора', author: null, layout_config: { accent: 'gold' }, sort_order: 2 },
    ];
    const blocksByArticle: Record<string, BlockRow[]> = {
      a1: [{ id: 'b1', type: 'heading', content: 'Първа', position: 0, metadata: { level: 1 } }],
      a2: [{ id: 'b2', type: 'heading', content: 'Втора', position: 0, metadata: { level: 1 } }],
    };
    const inserts = [{ id: 'ad1', image_url: 'http://x/ad.jpg', sort_order: 1, kind: 'image' }];
    const items = buildRenderItems(articles, blocksByArticle, inserts);
    expect(items.map((i) => i.kind)).toEqual(['article', 'insert', 'article']);
    expect(items[1]).toMatchObject({ kind: 'insert', id: 'ad1', imageUrl: 'http://x/ad.jpg' });
    if (items[0].kind === 'article') expect(items[0].doc.title).toBe('Първа');
  });

  it("passes an advert's link through to the print view", () => {
    const inserts = [{ id: 'ad1', image_url: 'http://x/ad.jpg', sort_order: 0, kind: 'image', link_url: 'https://night.nauka.bg' }];
    const [item] = buildRenderItems([], {}, inserts);
    expect(item).toMatchObject({ kind: 'insert', href: 'https://night.nauka.bg' });
  });

  it('leaves an advert without a link unlinked', () => {
    const inserts = [{ id: 'ad1', image_url: 'http://x/ad.jpg', sort_order: 0, kind: 'image', link_url: null }];
    const [item] = buildRenderItems([], {}, inserts);
    expect(item.kind === 'insert' && item.href).toBeFalsy();
  });
});
