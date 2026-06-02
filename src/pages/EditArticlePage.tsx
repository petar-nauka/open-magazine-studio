import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Layers, Sparkles, Save, Loader2, Tag, X, MessageSquare } from 'lucide-react';
import { MagazinePreviewFrame, type MagazinePreviewFrameHandle } from '../magazine/MagazinePreviewFrame';
import { articleFromParsed } from '../lib/document-model';
import { LayoutSettings } from '../components/LayoutSettings';
import { BrandingPanel } from '../components/BrandingPanel';
import { BlockEditor } from '../components/BlockEditor';
import { AIChatPanel } from '../components/AIChatPanel';
import { type ContentBlock } from '../lib/paste-parser';
import { generateLayout, getDefaultBranding, type MagazineLayout, type BrandingConfig } from '../lib/layout-engine';
import { supabase } from '../lib/supabase';
import { Toast } from '../components/Toast';
import { AccentPicker } from '../components/AccentPicker';
import type { AccentName } from '../design-system/brand';

interface Category {
  id: string;
  name: string;
  issue_number: number | null;
}

export function EditArticlePage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [layout, setLayout] = useState<MagazineLayout | null>(null);
  const [accentColor, setAccentColor] = useState('#1a5f3a');
  const [font, setFont] = useState('Georgia');
  const [branding, setBranding] = useState<BrandingConfig>(getDefaultBranding());
  const [status, setStatus] = useState('draft');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [generatingLayout, setGeneratingLayout] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accent, setAccent] = useState<AccentName | string>('teal');

  const previewRef = useRef<MagazinePreviewFrameHandle>(null);
  const previewDoc = useMemo(
    () => articleFromParsed({ title, blocks }, { author, accent }),
    [title, blocks, author, accent]
  );

  useEffect(() => {
    if (id) loadArticle(id);
  }, [id]);

  const loadArticle = async (articleId: string) => {
    try {
      const [articleRes, blocksRes, categoriesRes] = await Promise.all([
        supabase.from('mag_pdf_articles').select('*').eq('id', articleId).maybeSingle(),
        supabase.from('mag_pdf_content_blocks').select('*').eq('article_id', articleId).order('position'),
        supabase.from('mag_pdf_categories').select('id, name, issue_number').order('issue_number', { ascending: false }),
      ]);

      if (articleRes.data) {
        const article = articleRes.data;
        setTitle(article.title);
        setAuthor(article.author || '');
        setStatus(article.status);
        setTags(article.tags || []);
        setCategoryId(article.category_id);

        if (article.layout_config && article.layout_config.pages) {
          setLayout(article.layout_config as MagazineLayout);
          setAccentColor(article.layout_config.accentColor || '#1a5f3a');
          setFont(article.layout_config.font || 'Georgia');
          if (article.layout_config.branding) {
            setBranding(article.layout_config.branding);
          }
          if (article.layout_config?.accent) setAccent(article.layout_config.accent);
        }
      }

      if (blocksRes.data) {
        setBlocks(blocksRes.data as ContentBlock[]);
        if (!articleRes.data?.layout_config?.pages && blocksRes.data.length > 0) {
          const generated = generateLayout(blocksRes.data as ContentBlock[]);
          setLayout(generated);
        }
      }

      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
    } catch (err) {
      console.error('Failed to load article:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    try {
      const layoutToSave = layout ? { ...layout, accentColor, font, branding, accent } : null;

      const { error } = await supabase
        .from('mag_pdf_articles')
        .update({
          title,
          author: author || null,
          layout_config: layoutToSave,
          status,
          tags,
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      setToast('Запазено ✓');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateLayout = async () => {
    if (blocks.length === 0) return;
    setGeneratingLayout(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-layout`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blocks }),
      });

      if (!response.ok) throw new Error('AI layout failed');

      const newLayout = await response.json();
      setLayout({ ...newLayout, font, accentColor, branding });
    } catch {
      const fallback = generateLayout(blocks, branding);
      setLayout(fallback);
    } finally {
      setGeneratingLayout(false);
    }
  };

  const handleBlocksChange = (updatedBlocks: ContentBlock[]) => {
    setBlocks(updatedBlocks);
    const newLayout = generateLayout(updatedBlocks, branding);
    setLayout({ ...newLayout, accentColor, font, branding });
  };

  const handleAIRewrite = async (blockId: string, instruction: string): Promise<string | null> => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return null;

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rewrite-block`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blockContent: block.content,
          instruction,
          blockType: block.type,
        }),
      });

      if (!response.ok) return null;
      const { rewritten } = await response.json();
      return rewritten || null;
    } catch {
      return null;
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/archive"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Архив
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 max-w-[300px]"
              placeholder="Заглавие"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
            >
              <option value="draft">Чернова</option>
              <option value="ready">Готова</option>
              <option value="exported">Експортирана</option>
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Запази
            </button>
            <button
              onClick={() => previewRef.current?.print()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007daa] rounded-lg hover:opacity-90 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Свали PDF
            </button>
            <button
              onClick={() => window.open(`/render?id=${id}`, '_blank')}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007daa] rounded-lg hover:opacity-90 transition-colors"
            >
              Преглед като списание
            </button>
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${chatOpen ? 'bg-gray-900 text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
            >
              <MessageSquare className="w-4 h-4" />
              AI Чат
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 flex gap-6">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 print:hidden">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto space-y-5">
            {/* Author */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Автор
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Име на автора"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div className="mb-5"><AccentPicker value={accent} onChange={setAccent} /></div>

            {/* Category / Issue */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Брой / Категория
              </label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">Без категория</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.issue_number ? `#${cat.issue_number} - ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                <Tag className="w-3.5 h-3.5" />
                Тагове
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-xs text-gray-700 rounded"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Добави таг..."
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-200"
                />
                <button
                  onClick={handleAddTag}
                  className="px-2 py-1.5 text-xs bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Layout settings */}
            <LayoutSettings
              accentColor={accentColor}
              onAccentColorChange={setAccentColor}
              font={font}
              onFontChange={setFont}
            />

            <BrandingPanel branding={branding} onChange={setBranding} />

            {/* AI */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Sparkles className="w-4 h-4" />
                AI помощник
              </div>
              <button
                onClick={handleGenerateLayout}
                disabled={generatingLayout || blocks.length === 0}
                className="w-full px-3 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {generatingLayout ? 'Генериране...' : 'Пренареди layout (AI)'}
              </button>
            </div>
          </div>
        </aside>

        {/* Center: preview */}
        <main className="flex-1 min-w-0 print:w-full">
          <div className="h-[calc(100vh-120px)] sticky top-20">
            <MagazinePreviewFrame ref={previewRef} doc={previewDoc} />
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="w-96 shrink-0 print:hidden">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
              <Layers className="w-4 h-4" />
              Редактор ({blocks.length} блока)
            </div>
            {blocks.length > 0 && (
              <BlockEditor
                blocks={blocks}
                onChange={handleBlocksChange}
                onAIRewrite={handleAIRewrite}
              />
            )}
          </div>
        </aside>
      </div>

      <AIChatPanel
        blocks={blocks}
        articleTitle={title}
        onBlocksChange={handleBlocksChange}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
      {toast && (<Toast message={toast} onClose={() => setToast(null)} />)}
    </div>
  );
}
