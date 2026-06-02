import { BG_NAUKA, type AccentName } from './brand';
export interface AccentOption { name: AccentName; hex: string; label: string; }
export const ACCENT_OPTIONS: AccentOption[] = [
  { name: 'teal', hex: BG_NAUKA.accents.teal, label: 'Тюркоаз' },
  { name: 'magenta', hex: BG_NAUKA.accents.magenta, label: 'Магента' },
  { name: 'turquoise', hex: BG_NAUKA.accents.turquoise, label: 'Синьо-зелен' },
  { name: 'gold', hex: BG_NAUKA.accents.gold, label: 'Златен' },
  { name: 'indigo', hex: BG_NAUKA.accents.indigo, label: 'Индиго' },
  { name: 'green', hex: BG_NAUKA.accents.green, label: 'Зелен' },
];
