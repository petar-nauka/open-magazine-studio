import { describe, it, expect } from 'vitest';
import { mergeIssueItems, moveItem, type IssueItem } from './inserts';

describe('mergeIssueItems', () => {
  it('orders articles and inserts by sort_order', () => {
    const articles = [
      { id: 'a', title: 'A', sort_order: 0 },
      { id: 'c', title: 'C', sort_order: 2 },
    ];
    const inserts = [{ id: 'b', image_url: 'u', sort_order: 1, kind: 'image' }];
    const items = mergeIssueItems(articles, inserts);
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(items.map((i) => i.kind)).toEqual(['article', 'insert', 'article']);
  });

  it('puts an article before an insert on equal sort_order', () => {
    const articles = [{ id: 'a', title: 'A', sort_order: 1 }];
    const inserts = [{ id: 'b', image_url: 'u', sort_order: 1, kind: 'image' }];
    expect(mergeIssueItems(articles, inserts).map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('moveItem', () => {
  it('moves an item down and renumbers densely', () => {
    const items: IssueItem[] = [
      { kind: 'article', id: 'a', sort_order: 0, title: 'A' },
      { kind: 'article', id: 'b', sort_order: 1, title: 'B' },
    ];
    const r = moveItem(items, 'a', 'down');
    expect(r.map((i) => i.id)).toEqual(['b', 'a']);
    expect(r.map((i) => i.sort_order)).toEqual([0, 1]);
  });

  it('reorders reliably even when all sort_order values collide (e.g. all 0)', () => {
    const items: IssueItem[] = [
      { kind: 'article', id: 'a', sort_order: 0, title: 'A' },
      { kind: 'article', id: 'b', sort_order: 0, title: 'B' },
      { kind: 'insert', id: 'ad', sort_order: 0, image_url: 'u' },
    ];
    // merged order with tie-break (articles before inserts, stable): a, b, ad
    const r = moveItem(items, 'ad', 'up');
    expect(r.map((i) => i.id)).toEqual(['a', 'ad', 'b']);
    expect(r.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });

  it('is a no-op moving the first item up (returns the same array reference)', () => {
    const items: IssueItem[] = [
      { kind: 'article', id: 'a', sort_order: 0, title: 'A' },
      { kind: 'article', id: 'b', sort_order: 1, title: 'B' },
    ];
    expect(moveItem(items, 'a', 'up')).toBe(items);
  });
});
