import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Layers, Save, Loader2, MessageSquare } from 'lucide-react';
import { MagazinePreviewFrame, type MagazinePreviewFrameHandle } from '../magazine/MagazinePreviewFrame';
import { articleFromParsed, findTitleBlock } from '../lib/document-model';
import { ArticleSidebar } from '../components/ArticleSidebar';
import { BlockEditor } from '../components/BlockEditor';
import { AIChatPanel } from '../components/AIChatPanel';
import { type ContentBlock } from '../lib/paste-parser';
import { supabase } from '../lib/supabase';
import { Toast } from '../components/Toast';
import type { AccentName } from '../design-system/brand';
import type { Align } from '../design-system/alignment';

interface Category {
  id: string;
  name: string;
  issue_number: number | null;
}

export function EditArticlePage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Fallback title for articles that have no title heading; normally the title
  // is read from (and written to) the H1 block so it never drifts from the cover.
  const [dbTitle, setDbTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [status, setStatus] = useState('draft');
  const [tags, setTags] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accent, setAccent] = useState<AccentName | string>('teal');
  const [align, setAlign] = useState<Align>('justify');
  const [dropCap, setDropCap] = useState(true);
  const [openerImage, setOpenerImage] = useState<string | undefined>(undefined);

  // Title is the H1 block's text when present (single source of truth shared
  // with the cover), else the standalone fallback.
  const titleBlock = findTitleBlock(blocks);
  const title = titleBlock?.content ?? dbTitle;
  const setTitle = (val: string) => {
    if (titleBlock) {
      setBlocks((prev) => prev.map((b) => (b.id === titleBlock.id ? { ...b, content: val } : b)));
    } else {
      setDbTitle(val);
    }
  };

  const previewRef = useRef<MagazinePreviewFrameHandle>(null);
  const previewDoc = useMemo(
    () => articleFromParsed({ title, blocks }, { author, accent, align, dropCap, openerImage }),
    [title, blocks, author, accent, align, dropCap, openerImage]
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
        setDbTitle(article.title);
        setAuthor(article.author || '');
        setStatus(article.status);
        setTags(article.tags || []);
        setCategoryId(article.category_id);

        const lc = article.layout_config ?? {};
        if (lc.accent) setAccent(lc.accent);
        if (lc.align) setAlign(lc.align);
        if (typeof lc.dropCap === 'boolean') setDropCap(lc.dropCap);
        if (lc.openerImage) setOpenerImage(lc.openerImage);
      }

      if (blocksRes.data) {
        setBlocks(blocksRes.data as ContentBlock[]);
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
      const layoutToSave = { accent, align, dropCap, openerImage };

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

  const handleBlocksChange = (updatedBlocks: ContentBlock[]) => {
    setBlocks(updatedBlocks);
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
              Всички броеве
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
          <ArticleSidebar
            author={author}
            onAuthorChange={setAuthor}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            categories={categories}
            tags={tags}
            onTagsChange={setTags}
            images={blocks.filter((b) => b.type === 'image').map((b) => ({ id: b.id, url: b.content }))}
            openerImage={openerImage}
            onOpenerImageChange={setOpenerImage}
            accent={accent}
            onAccentChange={setAccent}
            align={align}
            onAlignChange={setAlign}
            dropCap={dropCap}
            onDropCapChange={setDropCap}
          />
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
