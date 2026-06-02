import { ACCENT_OPTIONS } from '../design-system/accent-list';
interface Props { value: string; onChange: (accent: string) => void; }
export function AccentPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Акцентен цвят на статията</label>
      <div className="flex flex-wrap gap-2">
        {ACCENT_OPTIONS.map((opt) => (
          <button key={opt.name} type="button" title={opt.label} onClick={() => onChange(opt.name)}
            className={`w-7 h-7 rounded-full border-2 transition ${value === opt.name ? 'border-gray-900 scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: opt.hex }} />
        ))}
        <input type="color" value={/^#/.test(value) ? value : '#007daa'} onChange={(e) => onChange(e.target.value)} title="Друг цвят"
          className="w-7 h-7 rounded-full border border-gray-200 p-0 cursor-pointer" />
      </div>
    </div>
  );
}
