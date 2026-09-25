import { describe, it, expect } from 'vitest';
import { nextSortOrder, pageCount, clampPage, pageWindow, issuesSearch } from './issues';

describe('nextSortOrder', () => {
  it('returns 0 for an empty issue', () => { expect(nextSortOrder([])).toBe(0); });
  it('returns max+1', () => { expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 3 }])).toBe(4); });
});

describe('pageCount', () => {
  it('is 1 even with no issues', () => { expect(pageCount(0, 20)).toBe(1); });
  it('fits an exact multiple', () => { expect(pageCount(40, 20)).toBe(2); });
  it('rounds a partial page up', () => { expect(pageCount(41, 20)).toBe(3); });
});

describe('clampPage', () => {
  it('falls back to 1 for garbage', () => {
    expect(clampPage(NaN, 3)).toBe(1);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(-4, 3)).toBe(1);
  });
  it('caps at the last page', () => { expect(clampPage(9, 3)).toBe(3); });
  it('floors fractions', () => { expect(clampPage(2.7, 3)).toBe(2); });
});

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('collapses the middle with gaps', () => {
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
  });
  it('does not put a gap next to the first page', () => {
    expect(pageWindow(2, 12)).toEqual([1, 2, 3, 'gap', 12]);
  });
  it('does not put a gap next to the last page', () => {
    expect(pageWindow(11, 12)).toEqual([1, 'gap', 10, 11, 12]);
  });
  it('fills a one-page hole instead of drawing a gap', () => {
    expect(pageWindow(4, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
  });
});

describe('issuesSearch', () => {
  it('keeps the first active page at a bare /', () => {
    expect(issuesSearch({ archived: false, page: 1 })).toEqual({});
  });
  it('adds the page after the first', () => {
    expect(issuesSearch({ archived: false, page: 3 })).toEqual({ page: '3' });
  });
  it('marks the archive view', () => {
    expect(issuesSearch({ archived: true, page: 1 })).toEqual({ view: 'archive' });
    expect(issuesSearch({ archived: true, page: 2 })).toEqual({ view: 'archive', page: '2' });
  });
});
