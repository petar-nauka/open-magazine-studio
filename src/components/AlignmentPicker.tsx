import { AlignJustify, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { ALIGN_OPTIONS, type Align } from '../design-system/alignment';

const ICONS: Record<Align, typeof AlignLeft> = {
  justify: AlignJustify, left: AlignLeft, center: AlignCenter, right: AlignRight,
};

interface Props {
  value: Align | undefined;
  onChange: (a: Align | undefined) => void;
  // When true (per-block), clicking the active button clears it (inherit from article).
  allowInherit?: boolean;
  label?: string;
}

export function AlignmentPicker({ value, onChange, allowInherit, label }: Props) {
  return (
    <div>
      {label && (
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">{label}</label>
      )}
      <div className="flex gap-1">
        {ALIGN_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.value];
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.label}
              onClick={() => onChange(allowInherit && active ? undefined : opt.value)}
              className={`p-1.5 rounded border transition ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
