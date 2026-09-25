import { describe, it, expect } from 'vitest';
import { normalizeHref } from './links';

describe('normalizeHref', () => {
  it('treats blank input as no link', () => {
    expect(normalizeHref('')).toBeUndefined();
    expect(normalizeHref('   ')).toBeUndefined();
  });
  it('keeps a full URL as typed', () => {
    expect(normalizeHref(' https://night.nauka.bg/ ')).toBe('https://night.nauka.bg/');
    expect(normalizeHref('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });
  it('adds https:// to a bare domain, which would otherwise be a broken relative link', () => {
    expect(normalizeHref('night.nauka.bg')).toBe('https://night.nauka.bg');
    expect(normalizeHref('www.nauka.bg/za-nas')).toBe('https://www.nauka.bg/za-nas');
    expect(normalizeHref('//nauka.bg')).toBe('https://nauka.bg');
  });
  it('keeps mail and phone links', () => {
    expect(normalizeHref('mailto:office@nauka.bg')).toBe('mailto:office@nauka.bg');
    expect(normalizeHref('tel:+359888123456')).toBe('tel:+359888123456');
  });
  it('refuses script-running schemes', () => {
    expect(normalizeHref('javascript:alert(1)')).toBeUndefined();
    expect(normalizeHref(' JavaScript:alert(1)')).toBeUndefined();
    expect(normalizeHref('data:text/html,<b>x</b>')).toBeUndefined();
  });
});
