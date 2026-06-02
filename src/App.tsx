import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Download, Layers, ArrowLeft, Settings, Archive, MessageSquare } from 'lucide-react';
import { PasteZone } from './components/PasteZone';
import { BlockEditor } from './components/BlockEditor';
import { AIChatPanel } from './components/AIChatPanel';
import { MagazinePreviewFrame, type MagazinePreviewFrameHandle } from './magazine/MagazinePreviewFrame';
import { ArticleSidebar } from './components/ArticleSidebar';
import { type ParsedArticle, type ContentBlock } from './lib/paste-parser';
import { articleFromParsed } from './lib/document-model';
import { uploadArticleImages } from './lib/image-upload';
import { supabase } from './lib/supabase';
import { nextSortOrder } from './lib/issues';
import { Toast } from './components/Toast';
import type { AccentName } from './design-system/brand';
import type { Align } from './design-system/alignment';

type AppView = 'paste' | 'editor';

function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<AppView>('paste');
  const [article, setArticle] = useState<ParsedArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [articleAuthor, setArticleAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(searchParams.get('issue'));
  const [categories, setCategories] = useState<{ id: string; name: string; issue_number: number | null }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [accent, setAccent] = useState<AccentName | string>('teal');
  const [align, setAlign] = useState<Align>('justify');
  const [dropCap, setDropCap] = useState(true);
  const [openerImage, setOpenerImage] = useState<string | undefined>(undefined);

  const previewRef = useRef<MagazinePreviewFrameHandle>(null);
  const previewDoc = useMemo(
    () => (article ? articleFromParsed(article, { author: articleAuthor, accent, align, dropCap, openerImage }) : null),
    [article, articleAuthor, accent, align, dropCap, openerImage]
  );

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('mag_pdf_categories')
      .select('id, name, issue_number')
      .order('issue_number', { ascending: false });
    if (data) setCategories(data);
  };

  const handleArticleParsed = useCallback(async (parsed: ParsedArticle) => {
    let imported = parsed;
    const hasDataImages = parsed.blocks.some((b) => b.type === 'image' && b.content.startsWith('data:'));
    if (hasDataImages) {
      setImporting({ done: 0, total: 0 });
      try {
        imported = await uploadArticleImages(parsed, (done, total) => setImporting({ done, total }));
      } catch (err) {
        console.error('Image upload failed, keeping inline images:', err);
        imported = parsed;
      } finally {
        setImporting(null);
      }
    }
    setArticle(imported);
    setView('editor');
  }, []);

  const handleSave = async () => {
    if (!article) return;
    setSaving(true);

    try {
      const layoutToSave = { accent, align, dropCap, openerImage };

      if (savedId) {
        const { error } = await supabase
          .from('mag_pdf_articles')
          .update({
            title: article.title,
            author: articleAuthor || null,
            layout_config: layoutToSave,
            tags,
            category_id: categoryId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', savedId);
        if (error) throw error;
      } else {
        let sortOrder = 0;
        if (categoryId) {
          const { data: existing } = await supabase
            .from('mag_pdf_articles')
            .select('sort_order')
            .eq('category_id', categoryId);
          sortOrder = nextSortOrder(existing ?? []);
        }
        const { data: articleData, error: articleError } = await supabase
          .from('mag_pdf_articles')
          .insert({
            title: article.title,
            author: articleAuthor || null,
            layout_config: layoutToSave,
            status: 'draft',
            tags,
            category_id: categoryId,
            sort_order: sortOrder,
          })
          .select('id')
          .maybeSingle();

        if (articleError) throw articleError;
        if (!articleData) throw new Error('Failed to save article');
        setSavedId(articleData.id);

        const blocksToInsert = article.blocks.map((block) => ({
          article_id: articleData.id,
          type: block.type,
          content: block.content,
          position: block.position,
          metadata: block.metadata,
        }));

        const { error: blocksError } = await supabase.from('mag_pdf_content_blocks').insert(blocksToInsert);
        if (blocksError) throw blocksError;
      }
      setToast('Запазено ✓');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBlocksChange = (updatedBlocks: ContentBlock[]) => {
    if (!article) return;
    setArticle({ ...article, blocks: updatedBlocks });
  };

  const handleAIRewrite = async (blockId: string, instruction: string): Promise<string | null> => {
    const block = article?.blocks.find((b) => b.id === blockId);
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

      if (!response.ok) {
        const err = await response.json();
        console.error('AI rewrite failed:', err);
        return null;
      }

      const { rewritten } = await response.json();
      return rewritten || null;
    } catch (err) {
      console.error('AI rewrite error:', err);
      return null;
    }
  };

  const blockCounts = article
    ? {
        text: article.blocks.filter((b: ContentBlock) => b.type === 'text').length,
        images: article.blocks.filter((b: ContentBlock) => b.type === 'image').length,
        headings: article.blocks.filter((b: ContentBlock) => b.type === 'heading').length,
      }
    : null;

  if (view === 'paste') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Magazine Studio</h1>
                <p className="text-xs text-gray-500">Трансформирай статии в красив дизайн</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/archive"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Archive className="w-4 h-4" />
                Архив
              </Link>
              <Link
                to="/settings/ai"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Настройки
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Създай списание за минути
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Копирай статия от Google Docs - със снимки и форматиране - и я превърни
              в професионален magazine layout, готов за PDF експорт.
            </p>
          </div>

          <PasteZone onArticleParsed={handleArticleParsed} />

          {importing && (
            <div className="fixed inset-0 z-40 bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 px-8 py-6 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-[#007daa] animate-spin" />
                <div className="text-sm font-medium text-gray-800">Подготвям снимките за списанието…</div>
                {importing.total > 0 && (<div className="text-xs text-gray-500">{importing.done} / {importing.total} качени</div>)}
              </div>
            </div>
          )}

          <div className="mt-12 grid grid-cols-3 gap-6">
            <StepCard
              number={1}
              title="Постави"
              description="Ctrl+A, Ctrl+C от Google Docs, после Ctrl+V тук"
              active
            />
            <StepCard
              number={2}
              title="Оформи"
              description="AI предлага layout, ти финализираш дизайна"
            />
            <StepCard
              number={3}
              title="Експортни"
              description="Генерирай PDF, готов за печат или дигитално разпространение"
            />
          </div>
        </main>
        {toast && (<Toast message={toast} onClose={() => setToast(null)} actionLabel="Виж в архива" onAction={() => navigate('/archive')} />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('paste')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Нова статия
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">
              {article?.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {blockCounts && (
              <div className="flex items-center gap-3 text-xs text-gray-500 mr-4">
                <span>{blockCounts.text} текста</span>
                <span>{blockCounts.images} снимки</span>
                <span>{blockCounts.headings} заглавия</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? 'Запазване...' : 'Запази'}
            </button>
            <button
              onClick={() => previewRef.current?.print()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007daa] rounded-lg hover:opacity-90 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Свали PDF
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
        {/* Left sidebar: settings */}
        <aside className="w-72 shrink-0 print:hidden">
          <ArticleSidebar
            author={articleAuthor}
            onAuthorChange={setArticleAuthor}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            categories={categories}
            tags={tags}
            onTagsChange={setTags}
            images={(article?.blocks ?? []).filter((b) => b.type === 'image').map((b) => ({ id: b.id, url: b.content }))}
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
            {previewDoc && <MagazinePreviewFrame ref={previewRef} doc={previewDoc} />}
          </div>
        </main>

        {/* Right sidebar: block editor */}
        <aside className="w-96 shrink-0 print:hidden">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
              <Layers className="w-4 h-4" />
              Редактор ({article?.blocks.length || 0} блока)
            </div>
            {article && (
              <BlockEditor
                blocks={article.blocks}
                onChange={handleBlocksChange}
                onAIRewrite={handleAIRewrite}
              />
            )}
          </div>
        </aside>
      </div>

      {article && (
        <AIChatPanel
          blocks={article.blocks}
          articleTitle={article.title}
          onBlocksChange={handleBlocksChange}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
      {toast && (<Toast message={toast} onClose={() => setToast(null)} actionLabel="Виж в архива" onAction={() => navigate('/archive')} />)}
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  active,
}: {
  number: number;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div
      className={`
        p-5 rounded-xl border transition-all
        ${active ? 'border-gray-300 bg-white shadow-sm' : 'border-gray-200 bg-gray-50/50'}
      `}
    >
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-3
          ${active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}
        `}
      >
        {number}
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

export default App;
