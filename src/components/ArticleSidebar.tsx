import { useState } from 'react';
import { AccentPicker } from './AccentPicker';
import { AlignmentPicker } from './AlignmentPicker';
import { OpenerImagePicker } from './OpenerImagePicker';
import type { AccentName } from '../design-system/brand';
import type { Align } from '../design-system/alignment';

interface Category {
  id: string;
  name: string;
  issue_number: number | null;
}

interface Props {
  author: string;
  onAuthorChange: (v: string) => void;
  categoryId: string | null;
  onCategoryChange: (v: string | null) => void;
  categories: Category[];
  tags: string[];
  onTagsChange: (v: string[]) => void;
  images: { id: string; url: string }[];
  openerImage: string | undefined;
  onOpenerImageChange: (v: string | undefined) => void;
  accent: AccentName | string;
  onAccentChange: (v: AccentName | string) => void;
  align: Align;
  onAlignChange: (v: Align) => void;
  dropCap: boolean;
  onDropCapChange: (v: boolean) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h3>;
}

export function ArticleSidebar(props: Props) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !props.tags.includes(tag)) props.onTagsChange([...props.tags, tag]);
    setTagInput('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* СТАТИЯ */}
      <section>
        <SectionLabel>Статия</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Автор</label>
            <input
              type="text"
              value={props.author}
              onChange={(e) => props.onAuthorChange(e.target.value)}
              placeholder="Име на автора"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Брой / Категория</label>
            <select
              value={props.categoryId || ''}
              onChange={(e) => props.onCategoryChange(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="">Без категория</option>
              {props.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.issue_number ? `#${cat.issue_number} - ` : ''}{cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Тагове</label>
            {props.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {props.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-[10px] text-gray-700 rounded">
                    {tag}
                    <button onClick={() => props.onTagsChange(props.tags.filter((t) => t !== tag))} className="text-gray-400 hover:text-gray-700">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Добави таг..."
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-200"
            />
          </div>
        </div>
      </section>

      {/* КОРИЦА */}
      <section className="mt-5 pt-5 border-t border-gray-100">
        <SectionLabel>Корица</SectionLabel>
        <OpenerImagePicker images={props.images} value={props.openerImage} onChange={props.onOpenerImageChange} />
      </section>

      {/* СТИЛ */}
      <section className="mt-5 pt-5 border-t border-gray-100">
        <SectionLabel>Стил</SectionLabel>
        <div className="space-y-4">
          <AccentPicker value={props.accent} onChange={props.onAccentChange} />
          <AlignmentPicker value={props.align} onChange={(a) => props.onAlignChange(a ?? 'justify')} label="Подравняване на текста" />
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-700">Голяма първа буква</span>
            <button
              type="button"
              role="switch"
              aria-checked={props.dropCap}
              onClick={() => props.onDropCapChange(!props.dropCap)}
              className={`relative w-9 h-5 rounded-full transition-colors ${props.dropCap ? 'bg-gray-900' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${props.dropCap ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        </div>
      </section>
    </div>
  );
}
