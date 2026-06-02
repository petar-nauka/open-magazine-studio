import { describe, it, expect } from 'vitest';
import { nextSortOrder } from './issues';

describe('nextSortOrder', () => {
  it('returns 0 for an empty issue', () => { expect(nextSortOrder([])).toBe(0); });
  it('returns max+1', () => { expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 3 }])).toBe(4); });
});
