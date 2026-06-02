import { describe, it, expect } from 'vitest';
import { BG_NAUKA, resolveAccent, type AccentName } from './brand';

describe('BG_NAUKA brand', () => {
  it('uses the brand blue and white', () => {
    expect(BG_NAUKA.brandColor).toBe('#007daa');
    expect(BG_NAUKA.paperColor).toBe('#ffffff');
  });

  it('defines Montserrat for headings and Andika for body', () => {
    expect(BG_NAUKA.fonts.heading).toContain('Montserrat');
    expect(BG_NAUKA.fonts.body).toContain('Andika');
  });

  it('has a 6-colour accent palette', () => {
    expect(Object.keys(BG_NAUKA.accents)).toHaveLength(6);
  });

  it('has four logo variants', () => {
    expect(BG_NAUKA.logos.horizontalDark).toMatch(/logo-01/);
    expect(BG_NAUKA.logos.horizontalWhite).toMatch(/logo-03/);
    expect(BG_NAUKA.logos.iconOnly).toMatch(/logo-09/);
    expect(BG_NAUKA.logos.wordmarkBlue).toMatch(/logo-12/);
  });
});

describe('resolveAccent', () => {
  it('returns the hex for a known accent name', () => {
    expect(resolveAccent('teal')).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('falls back to brand blue for unknown / custom', () => {
    expect(resolveAccent('does-not-exist' as AccentName)).toBe('#007daa');
  });
  it('passes a custom hex through unchanged', () => {
    expect(resolveAccent('#abc123')).toBe('#abc123');
  });
});
