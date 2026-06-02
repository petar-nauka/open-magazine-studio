export type Align = 'justify' | 'left' | 'center' | 'right';

export interface AlignOption { value: Align; label: string; }

// Order shown in the picker. Labels are Bulgarian (UI language).
export const ALIGN_OPTIONS: AlignOption[] = [
  { value: 'justify', label: 'Двустранно' },
  { value: 'left', label: 'Ляво' },
  { value: 'center', label: 'Центрирано' },
  { value: 'right', label: 'Дясно' },
];

// A block's override wins; otherwise the article default applies.
export function effectiveAlign(blockAlign: Align | undefined, articleAlign: Align): Align {
  return blockAlign ?? articleAlign;
}
