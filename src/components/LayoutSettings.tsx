import { Palette, Type } from 'lucide-react';

interface LayoutSettingsProps {
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  font: string;
  onFontChange: (font: string) => void;
}

const ACCENT_COLORS = [
  { name: 'Emerald', value: '#1a5f3a' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Crimson', value: '#8b1a1a' },
  { name: 'Charcoal', value: '#2d2d2d' },
  { name: 'Teal', value: '#0d5e5e' },
  { name: 'Rust', value: '#8b4513' },
];

const FONTS = [
  { name: 'Georgia', value: 'Georgia' },
  { name: 'Playfair', value: 'Playfair Display' },
  { name: 'Merriweather', value: 'Merriweather' },
  { name: 'Lora', value: 'Lora' },
];

export function LayoutSettings({
  accentColor,
  onAccentColorChange,
  font,
  onFontChange,
}: LayoutSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Palette className="w-4 h-4" />
          Акцентен цвят
        </label>
        <div className="grid grid-cols-3 gap-2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              className={`
                h-10 rounded-lg border-2 transition-all duration-200
                ${accentColor === color.value ? 'border-gray-900 scale-105 shadow-md' : 'border-transparent hover:border-gray-300'}
              `}
              style={{ backgroundColor: color.value }}
              onClick={() => onAccentColorChange(color.value)}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Type className="w-4 h-4" />
          Шрифт
        </label>
        <div className="space-y-1.5">
          {FONTS.map((f) => (
            <button
              key={f.value}
              className={`
                w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                ${font === f.value ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}
              `}
              style={{ fontFamily: f.value }}
              onClick={() => onFontChange(f.value)}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
