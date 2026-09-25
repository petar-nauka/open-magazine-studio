import { describe, it, expect } from 'vitest';
import { mergeIssueItems, moveItem, moveItemTo, type IssueItem } from './inserts';

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

  it("carries an insert's link", () => {
    const inserts = [{ id: 'b', image_url: 'u', sort_order: 0, kind: 'image', link_url: 'https://night.nauka.bg' }];
    expect(mergeIssueItems([], inserts)[0].link_url).toBe('https://night.nauka.bg');
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

describe('moveItemTo', () => {
  const items: IssueItem[] = [
    { kind: 'article', id: 'a', sort_order: 0, title: 'A' },
    { kind: 'article', id: 'b', sort_order: 1, title: 'B' },
    { kind: 'insert', id: 'ad', sort_order: 2, image_url: 'u' },
    { kind: 'article', id: 'c', sort_order: 3, title: 'C' },
  ];

  it('drops the last item straight into first place', () => {
    const r = moveItemTo(items, 'c', 0);
    expect(r.map((i) => i.id)).toEqual(['c', 'a', 'b', 'ad']);
    expect(r.map((i) => i.sort_order)).toEqual([0, 1, 2, 3]);
  });

  it('moves an advert into second place', () => {
    expect(moveItemTo(items, 'ad', 1).map((i) => i.id)).toEqual(['a', 'ad', 'b', 'c']);
  });

  it('moves the first item to the end', () => {
    expect(moveItemTo(items, 'a', 3).map((i) => i.id)).toEqual(['b', 'ad', 'c', 'a']);
  });

  it('clamps a target past either end', () => {
    expect(moveItemTo(items, 'b', 99).map((i) => i.id)).toEqual(['a', 'ad', 'c', 'b']);
    expect(moveItemTo(items, 'b', -5).map((i) => i.id)).toEqual(['b', 'a', 'ad', 'c']);
  });

  it('is a no-op for the same place or an unknown id (same array reference)', () => {
    expect(moveItemTo(items, 'b', 1)).toBe(items);
    expect(moveItemTo(items, 'zzz', 0)).toBe(items);
  });

  it('renumbers densely even when every sort_order collides', () => {
    const flat: IssueItem[] = [
      { kind: 'article', id: 'a', sort_order: 0, title: 'A' },
      { kind: 'article', id: 'b', sort_order: 0, title: 'B' },
      { kind: 'insert', id: 'ad', sort_order: 0, image_url: 'u' },
    ];
    const r = moveItemTo(flat, 'ad', 0);
    expect(r.map((i) => i.id)).toEqual(['ad', 'a', 'b']);
    expect(r.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });
});
