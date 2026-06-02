export type AccentName = 'teal' | 'magenta' | 'turquoise' | 'gold' | 'indigo' | 'green';

export interface BrandConfig {
  brandColor: string;
  paperColor: string;
  fonts: { heading: string; body: string };
  accents: Record<AccentName, string>;
  logos: {
    horizontalDark: string;
    horizontalWhite: string;
    iconOnly: string;
    wordmarkBlue: string;
  };
  headerLeft: string;
  headerRight: string;
}

// Starting values seeded from issue 198. Tweak the accent hexes against the
// printed issue during visual validation; these are real defaults, not placeholders.
export const BG_NAUKA: BrandConfig = {
  brandColor: '#007daa',
  paperColor: '#ffffff',
  fonts: {
    heading: "'Montserrat', sans-serif",
    body: "'Andika', sans-serif",
  },
  accents: {
    teal: '#1ca0c4',
    magenta: '#c0388a',
    turquoise: '#2a8f9e',
    gold: '#c8902a',
    indigo: '#3b4ea0',
    green: '#3a8f5a',
  },
  logos: {
    horizontalDark: '/brand/logo-01.png',
    horizontalWhite: '/brand/logo-03.png',
    iconOnly: '/brand/logo-09.png',
    wordmarkBlue: '/brand/logo-12.png',
  },
  headerLeft: 'БЪЛГАРСКА НАУКА',
  headerRight: 'WWW.NAUKA.BG',
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function resolveAccent(accent: AccentName | string): string {
  if (typeof accent === 'string' && HEX_RE.test(accent)) return accent;
  return BG_NAUKA.accents[accent as AccentName] ?? BG_NAUKA.brandColor;
}
