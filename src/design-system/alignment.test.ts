import { describe, it, expect } from 'vitest';
import { effectiveAlign, ALIGN_OPTIONS } from './alignment';

describe('effectiveAlign', () => {
  it('uses the block override when set', () => {
    expect(effectiveAlign('center', 'justify')).toBe('center');
  });
  it('falls back to the article default when block is undefined', () => {
    expect(effectiveAlign(undefined, 'right')).toBe('right');
  });
});

describe('ALIGN_OPTIONS', () => {
  it('lists the four alignments', () => {
    expect(ALIGN_OPTIONS.map((o) => o.value)).toEqual(['justify', 'left', 'center', 'right']);
  });
});
