import { useState, useRef } from 'react';
import { type ContentBlock } from '../lib/paste-parser';
import {
  Image,
  Type,
  Heading,
  Quote,
  GripVertical,
  Trash2,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Plus,
  ImagePlus,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { AlignmentPicker } from './AlignmentPicker';
import { compressDataUrl, uploadImage } from '../lib/image-upload';

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  onAIRewrite?: (blockId: string, instruction: string) => Promise<string | null>;
}

export function BlockEditor({ blocks, onChange, onAIRewrite }: BlockEditorProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [aiPromptBlockId, setAiPromptBlockId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, position: i })));
  };

  const moveBlock = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...blocks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    onChange(updated.map((b, i) => ({ ...b, position: i })));
  };

  const addBlockAfter = (afterIdx: number, type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      content: '',
      position: afterIdx + 1,
      metadata: type === 'heading' ? { level: 2 } : {},
    };
    const updated = [...blocks];
    updated.splice(afterIdx + 1, 0, newBlock);
    onChange(updated.map((b, i) => ({ ...b, position: i })));
    setActiveBlockId(newBlock.id);
  };

  const handleAIRewrite = async (blockId: string) => {
    if (!onAIRewrite || !aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await onAIRewrite(blockId, aiPrompt.trim());
      if (result) {
        updateBlock(blockId, { content: result });
      }
    } finally {
      setAiLoading(false);
      setAiPromptBlockId(null);
      setAiPrompt('');
    }
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    dragRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragRef.current !== null && dragRef.current !== idx) {
      moveBlock(dragRef.current, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
    dragRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
    dragRef.current = null;
  };

  return (
    <div className="space-y-1">
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={handleDragEnd}
          className={`
            group relative rounded-lg border transition-all
            ${activeBlockId === block.id ? 'border-gray-300 bg-white shadow-sm' : 'border-transparent hover:border-gray-200 bg-white/50 hover:bg-white'}
            ${dragIdx === idx ? 'opacity-50' : ''}
            ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-t-blue-400' : ''}
          `}
        >
          {/* Block header */}
          <div className="flex items-center gap-1 px-2 py-1.5">
            <div
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
              title="Влачи за преподреждане"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${getBlockColor(block.type)}`}>
              {getBlockIcon(block.type)}
            </div>

            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider ml-1">
              {getBlockLabel(block.type)}
              {block.type === 'heading' && block.metadata.level ? ` H${block.metadata.level}` : ''}
            </span>

            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {block.type !== 'image' && (
                <AlignmentPicker
                  value={block.metadata.align}
                  allowInherit
                  onChange={(a) => updateBlock(block.id, { metadata: { ...block.metadata, align: a } })}
                />
              )}
              {block.type === 'text' && onAIRewrite && (
                <button
                  onClick={() => {
                    setAiPromptBlockId(aiPromptBlockId === block.id ? null : block.id);
                    setAiPrompt('');
                  }}
                  className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  title="AI пренапиши"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              {idx > 0 && (
                <button
                  onClick={() => moveBlock(idx, idx - 1)}
                  className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              )}
              {idx < blocks.length - 1 && (
                <button
                  onClick={() => moveBlock(idx, idx + 1)}
                  className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => removeBlock(block.id)}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Изтрий"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Block content */}
          <div className="px-2 pb-2">
            {block.type === 'image' ? (
              <ImageBlockEditor
                block={block}
                isActive={activeBlockId === block.id}
                onActivate={() => setActiveBlockId(block.id)}
                onChange={(updates) => updateBlock(block.id, updates)}
              />
            ) : (
              <TextBlockEditor
                block={block}
                isActive={activeBlockId === block.id}
                onActivate={() => setActiveBlockId(block.id)}
                onChange={(content) => updateBlock(block.id, { content })}
              />
            )}
          </div>

          {/* AI rewrite prompt */}
          {aiPromptBlockId === block.id && (
            <div className="px-2 pb-2">
              <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAIRewrite(block.id)}
                  placeholder="Напр: Направи по-кратко, Промени тона..."
                  className="flex-1 text-xs bg-transparent border-none focus:outline-none text-gray-700 placeholder:text-amber-400"
                  autoFocus
                />
                {aiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                ) : (
                  <>
                    <button
                      onClick={() => handleAIRewrite(block.id)}
                      disabled={!aiPrompt.trim()}
                      className="p-1 rounded text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setAiPromptBlockId(null); setAiPrompt(''); }}
                      className="p-1 rounded text-gray-400 hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Add block button (between blocks) */}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <AddBlockMenu onAdd={(type) => addBlockAfter(idx, type)} />
          </div>
        </div>
      ))}

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-xs text-gray-400 mb-3">Няма блокове</p>
          <AddBlockMenu onAdd={(type) => addBlockAfter(-1, type)} inline />
        </div>
      )}
    </div>
  );
}

function TextBlockEditor({
  block,
  isActive,
  onActivate,
  onChange,
}: {
  block: ContentBlock;
  isActive: boolean;
  onActivate: () => void;
  onChange: (content: string) => void;
}) {
  if (!isActive) {
    return (
      <div
        onClick={onActivate}
        className="text-xs text-gray-700 line-clamp-3 cursor-text px-1 py-0.5 rounded hover:bg-gray-50 min-h-[20px]"
      >
        {block.content || <span className="text-gray-400 italic">Празен блок...</span>}
      </div>
    );
  }

  return (
    <textarea
      value={block.content}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y min-h-[60px] leading-relaxed"
      autoFocus
      rows={Math.max(3, Math.ceil(block.content.length / 60))}
    />
  );
}

function ImageBlockEditor({
  block,
  isActive,
  onActivate,
  onChange,
}: {
  block: ContentBlock;
  isActive: boolean;
  onActivate: () => void;
  onChange: (updates: Partial<ContentBlock>) => void;
}) {
  const [urlInput, setUrlInput] = useState(block.content);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlChange = () => {
    if (urlInput !== block.content) {
      onChange({ content: urlInput });
    }
  };

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const blob = await compressDataUrl(dataUrl);
      const url = await uploadImage(blob);
      setUrlInput(url);
      onChange({ content: url });
    } catch (err) {
      alert('Грешка при качване на снимката: ' + String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div onClick={onActivate} className="cursor-pointer">
      {/* Image preview — empty placeholder doubles as an upload button */}
      <div className="w-full h-20 rounded-md overflow-hidden bg-gray-100 mb-1.5">
        {block.content ? (
          <img
            src={block.content}
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
            title="Кликни, за да качиш снимка"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Upload button (always available — also for replacing an existing image) */}
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] text-gray-600 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
        {uploading ? 'Качвам…' : 'Качи снимка'}
      </button>

      {/* URL input when active — optional, for an already-hosted image */}
      {isActive && (
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onBlur={handleUrlChange}
          onKeyDown={(e) => e.key === 'Enter' && handleUrlChange()}
          placeholder="...или постави URL на снимка"
          className="w-full text-[10px] px-2 py-1 mt-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-200 font-mono"
        />
      )}
    </div>
  );
}

function AddBlockMenu({ onAdd, inline }: { onAdd: (type: ContentBlock['type']) => void; inline?: boolean }) {
  const [open, setOpen] = useState(false);

  if (inline) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <button onClick={() => onAdd('text')} className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">
          + Текст
        </button>
        <button onClick={() => onAdd('heading')} className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">
          + Заглавие
        </button>
        <button onClick={() => onAdd('image')} className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">
          + Снимка
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 whitespace-nowrap">
          <button
            onClick={() => { onAdd('text'); setOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Type className="w-3.5 h-3.5" /> Текст
          </button>
          <button
            onClick={() => { onAdd('heading'); setOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Heading className="w-3.5 h-3.5" /> Заглавие
          </button>
          <button
            onClick={() => { onAdd('image'); setOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Image className="w-3.5 h-3.5" /> Снимка
          </button>
          <button
            onClick={() => { onAdd('pull_quote'); setOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Quote className="w-3.5 h-3.5" /> Цитат
          </button>
        </div>
      )}
    </div>
  );
}

function getBlockIcon(type: ContentBlock['type']) {
  const cls = 'w-3 h-3';
  switch (type) {
    case 'heading': return <Heading className={cls} />;
    case 'image': return <Image className={cls} />;
    case 'pull_quote': return <Quote className={cls} />;
    default: return <Type className={cls} />;
  }
}

function getBlockColor(type: ContentBlock['type']) {
  switch (type) {
    case 'heading': return 'bg-amber-100 text-amber-700';
    case 'image': return 'bg-blue-100 text-blue-700';
    case 'pull_quote': return 'bg-emerald-100 text-emerald-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getBlockLabel(type: ContentBlock['type']) {
  switch (type) {
    case 'heading': return 'Заглавие';
    case 'image': return 'Снимка';
    case 'pull_quote': return 'Цитат';
    default: return 'Текст';
  }
}
