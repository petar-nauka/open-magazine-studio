import { describe, it, expect } from 'vitest';
import { buildTocEntries } from './toc';
import type { RenderItem } from './load-issue-doc';

describe('buildTocEntries', () => {
  it('lists only articles, in order, with anchor + thumbnail', () => {
    const items: RenderItem[] = [
      { kind: 'article', id: 'a1', doc: { title: 'Първа', author: '', accent: 'teal', align: 'justify', openerImage: 'p1.jpg', blocks: [] } },
      { kind: 'insert', id: 'ad1', imageUrl: 'ad.jpg' },
      { kind: 'article', id: 'a2', doc: { title: 'Втора', author: '', accent: 'gold', align: 'justify', openerImage: undefined, blocks: [] } },
    ];
    expect(buildTocEntries(items)).toEqual([
      { anchorId: 'art-a1', title: 'Първа', thumbnail: 'p1.jpg' },
      { anchorId: 'art-a2', title: 'Втора', thumbnail: undefined },
    ]);
  });
});
