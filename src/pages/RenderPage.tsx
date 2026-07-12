import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MagazineDocument } from '../magazine/MagazineDocument';
import { TableOfContents } from '../magazine/TableOfContents';
import { usePaged } from '../magazine/usePaged';
import { articleFromParsed, type ArticleDoc } from '../lib/document-model';
import { resolveAccent } from '../design-system/brand';
import { getDraft } from '../lib/render-handoff';
import { loadArticleDoc } from '../lib/load-article';
import { nutritionExcerpt } from '../test-fixtures/nutrition-excerpt';
import { loadIssueDoc, type RenderItem } from '../lib/load-issue-doc';
import { buildTocEntries } from '../lib/toc';
import { loadBranding, applyBrandingVars } from '../lib/branding';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Resolve a single article doc for ?id= / draft / fixture (unchanged behaviour).
async function resolveDoc(id: string | null): Promise<ArticleDoc> {
  if (id) return loadArticleDoc(id);
  // Poll IndexedDB for the editor's draft. The editor writes it just before
  // opening the iframe, but a large article (many base64 images) can take a
  // moment; ~4.5s covers a slow write before falling back to the demo fixture
  // (which is what a bare /render visit with no draft is meant to show).
  for (let i = 0; i < 30; i++) {
    const draft = await getDraft();
    if (draft) return draft;
    await sleep(150);
  }
  return articleFromParsed(nutritionExcerpt, { author: 'Доц. Данаил Таков – ИБЕИ, БАН', accent: 'teal' });
}

export function RenderPage() {
  const [params] = useSearchParams();
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<RenderItem[] | null>(null);
  const [coverImage, setCoverImage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const issueId = params.get('issue');

  useEffect(() => {
    const run = async () => {
      // Apply branding CSS variables before pagination so the @page running
      // header/footer pick them up (Paged.js reads :root when it lays out).
      applyBrandingVars(await loadBranding());
      if (issueId) {
        const { coverImage, items } = await loadIssueDoc(issueId);
        setCoverImage(coverImage);
        setItems(items);
      } else {
        setItems([{ kind: 'article', id: 'single', doc: await resolveDoc(params.get('id')) }]);
      }
    };
    run().catch((e) => setError(String(e)));
  }, [params, issueId]);

  const firstArticle = items?.find((it): it is Extract<RenderItem, { kind: 'article' }> => it.kind === 'article');
  const accent = firstArticle ? resolveAccent(firstArticle.doc.accent) : '#007daa';
  const ready = usePaged(sourceRef, targetRef, accent, !!items);

  const tocEntries = items ? buildTocEntries(items) : [];

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-2">
        <a href="/" className="text-sm text-gray-600 hover:text-gray-900">← Начало</a>
        <button
          onClick={() => window.print()}
          disabled={!ready}
          title={ready ? undefined : 'Изчакай оформлението да приключи'}
          className="px-4 py-2 text-sm font-medium text-white bg-[#007daa] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ready ? 'Свали PDF' : 'Подготвям…'}
        </button>
      </div>
      {error && <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Грешка при зареждане: {error}</div>}
      {items && (
        <div ref={sourceRef} style={{ display: 'none' }}>
          {coverImage && (
            <div className="magazine">
              <section className="cover" style={{ backgroundImage: `url(${coverImage})` }} />
            </div>
          )}
          {issueId && tocEntries.length > 0 && <TableOfContents entries={tocEntries} />}
          {items.map((it) =>
            it.kind === 'article' ? (
              <MagazineDocument key={it.id} anchorId={`art-${it.id}`} doc={it.doc} />
            ) : (
              <div key={it.id} className="magazine">
                <section className="ad-plate" style={{ backgroundImage: `url(${it.imageUrl})` }} />
              </div>
            ),
          )}
        </div>
      )}
      <div ref={targetRef} />
    </>
  );
}
