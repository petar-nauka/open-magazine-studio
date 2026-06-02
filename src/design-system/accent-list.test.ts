import { describe, it, expect } from 'vitest';
import { ACCENT_OPTIONS } from './accent-list';
import { BG_NAUKA } from './brand';
describe('ACCENT_OPTIONS', () => {
  it('lists all six named brand accents with matching hex', () => {
    expect(ACCENT_OPTIONS).toHaveLength(6);
    for (const opt of ACCENT_OPTIONS) { expect(BG_NAUKA.accents[opt.name]).toBe(opt.hex); }
  });
});
