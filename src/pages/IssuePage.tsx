import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowUp, ArrowDown, Download, FileText, Image as ImageIcon, Trash2, Copy, Archive, ArchiveRestore, LibraryBig, GripVertical, Link2 } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import {
  loadIssue, setIssueCover, nextSortOrder, loadAllIssues,
  archiveArticleFromIssue, duplicateArticleToIssue, setIssueArchived, type Issue,
} from '../lib/issues';
import {
  loadInserts, addInsert, deleteInsert, setInsertLink, saveIssueOrder, mergeIssueItems, moveItem, moveItemTo,
  type IssueItem,
} from '../lib/inserts';
import { normalizeHref } from '../lib/links';
import { compressDataUrl, uploadImage, uploadRawFile } from '../lib/image-upload';
import { Toast } from '../components/Toast';
import { MediaLibraryModal } from '../components/MediaLibraryModal';

export function IssuePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [items, setItems] = useState<IssueItem[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [dupMenuFor, setDupMenuFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const adInput = useRef<HTMLInputElement>(null);
  // Which target a library pick should fill: a full-page ad, or the issue cover.
  const [picking, setPicking] = useState<'ad' | 'cover' | null>(null);
  // Drag-and-drop: the row being dragged, and where it would land (before/after a row).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ idx: number; after: boolean } | null>(null);
  // Reorders are saved one after another, so a slow save can't land after a newer one.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(() => {
    if (!id) return;
    setLoadError(null);
    Promise.all([loadIssue(id), loadInserts(id), loadAllIssues()])
      .then(([{ issue, articles }, inserts, all]) => {
        setIssue(issue);
        setItems(mergeIssueItems(articles, inserts));
        setAllIssues(all);
      })
      .catch((e) => {
        console.error('Неуспешно зареждане на броя', e);
        setLoadError('Неуспешно зареждане на броя. Провери връзката и опитай пак.');
      });
  }, [id]);
  useEffect(refresh, [refresh]);

  const handleArchive = async (articleId: string) => {
    if (!window.confirm('Да архивирам ли статията? Премахва се от броя, но остава в системата (Без категория).')) return;
    try {
      await archiveArticleFromIssue(articleId);
      refresh();
    } catch (e) {
      setToast('Грешка при архивиране: ' + String(e));
    }
  };

  // Reversible, so no confirm: the banner and the same button undo it.
  const toggleIssueArchived = async () => {
    if (!issue) return;
    const archive = !issue.archived_at;
    try {
      await setIssueArchived(issue.id, archive);
      refresh();
      setToast(archive ? 'Броят е в архива ✓ Вече не се показва в началната страница.' : 'Броят е върнат в активните ✓');
    } catch (e) {
      setToast('Грешка: ' + String(e));
    }
  };

  const handleDuplicate = async (articleId: string, targetCategoryId: string) => {
    setDupMenuFor(null);
    try {
      await duplicateArticleToIssue(articleId, targetCategoryId);
      refresh();
    } catch (e) {
      setToast('Грешка при дублиране: ' + String(e));
    }
  };

  // Show the new order at once and save in the background; only a failed save
  // reloads from the DB, which puts the real order back.
  const applyOrder = (next: IssueItem[]) => {
    if (next === items) return; // no-op move
    setItems(next);
    saveQueue.current = saveQueue.current
      .then(() => saveIssueOrder(next))
      .catch((e) => {
        setToast('Грешка при пренареждане: ' + String(e));
        refresh();
      });
  };

  const move = (itemId: string, dir: 'up' | 'down') => applyOrder(moveItem(items, itemId, dir));

  const endDrag = () => { setDragId(null); setDropAt(null); };

  // The upper half of a row drops before it, the lower half after it.
  const onRowDragOver = (e: React.DragEvent, idx: number) => {
    if (!dragId) return; // not one of our rows (e.g. a file dragged in)
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    if (dropAt?.idx !== idx || dropAt.after !== after) setDropAt({ idx, after });
  };

  const onRowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragId && dropAt) {
      const from = items.findIndex((i) => i.id === dragId);
      let to = dropAt.after ? dropAt.idx + 1 : dropAt.idx; // insertion point in the current list
      if (to > from) to -= 1;                              // ...once the row itself is taken out
      applyOrder(moveItemTo(items, dragId, to));
    }
    endDrag();
  };

  const saveAdLink = async (insertId: string, typed: string) => {
    const link = normalizeHref(typed) ?? null;
    const current = items.find((i) => i.id === insertId)?.link_url ?? null;
    if (link === current) return;
    try {
      await setInsertLink(insertId, link);
      setItems((prev) => prev.map((i) => (i.id === insertId ? { ...i, link_url: link } : i)));
      setToast(link ? 'Линкът на рекламата е запазен ✓' : 'Линкът на рекламата е махнат');
    } catch (e) {
      setToast('Грешка при запазване на линка: ' + String(e));
    }
  };

  const fileToDataUrl = (file: File) => new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
  });

  const onCover = async (file: File | undefined, field: 'cover_image_url' | 'cover_pdf_url') => {
    if (!file || !id) return;
    setUploading(true);
    try {
      // Upload to Storage and store only the URL: a base64 data URL in the DB
      // exceeds the server request-size limit, so the cover silently failed.
      const url = field === 'cover_pdf_url'
        ? await uploadRawFile(file)
        : await uploadImage(await compressDataUrl(await fileToDataUrl(file), 2400, 0.9));
      await setIssueCover(id, field, url);
      refresh();
    } catch (e) {
      const msg = String(e);
      const hint = /fetch|413|large|payload/i.test(msg)
        ? '\n\nВероятно файлът е твърде голям за сървъра (лимит ~1 MB). Опитай по-малък файл или вдигни лимита за качване на сървъра.'
        : '';
      setToast('Грешка при качване на корицата: ' + msg + hint);
    } finally {
      setUploading(false);
      if (imgInput.current) imgInput.current.value = '';
      if (pdfInput.current) pdfInput.current.value = '';
    }
  };

  const onAd = async (file: File | undefined) => {
    if (!file || !id) return;
    setUploading(true);
    try {
      const blob = await compressDataUrl(await fileToDataUrl(file));
      const url = await uploadImage(blob);
      await addInsert(id, url, nextSortOrder(items));
      refresh();
    } catch (e) {
      setToast('Грешка при качване на рекламата: ' + String(e));
    } finally {
      setUploading(false);
      if (adInput.current) adInput.current.value = '';
    }
  };

  // Reuse an image already in Storage. Nothing is uploaded or copied — the new
  // reference points at the same file, which is why the library refuses to
  // delete anything still in use.
  const onPickFromLibrary = async (url: string) => {
    const target = picking;
    setPicking(null);
    if (!id || !target) return;
    try {
      if (target === 'ad') await addInsert(id, url, nextSortOrder(items));
      else await setIssueCover(id, 'cover_image_url', url);
      refresh();
      setToast(target === 'ad' ? 'Рекламата е добавена от библиотеката ✓' : 'Корицата е сменена от библиотеката ✓');
    } catch (e) {
      setToast('Грешка: ' + String(e));
    }
  };

  const removeAd = async (insertId: string) => {
    if (!window.confirm('Да изтрия ли тази реклама?')) return;
    try {
      await deleteInsert(insertId);
      refresh();
    } catch (e) {
      setToast('Грешка при изтриване: ' + String(e));
    }
  };

  if (loadError) return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{loadError}</p>
          <button onClick={refresh} className="px-4 py-2 text-sm bg-[#007daa] text-white rounded-lg hover:opacity-90">Опитай пак</button>
        </div>
      </main>
    </div>
  );
  if (!issue) return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-12 text-center text-sm text-gray-400">Зареждане…</main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-gray-400">{issue.issue_number ? `Брой ${issue.issue_number}` : ''}</div>
            <h1 className="text-2xl font-bold text-gray-900">{issue.name}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.open(`/render?issue=${issue.id}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-[#007daa] text-white rounded-lg text-sm font-medium hover:opacity-90">
              <Download className="w-4 h-4" /> Свали целия брой
            </button>
            {issue.cover_pdf_url && (
              <a href={issue.cover_pdf_url} download={`korica-broy-${issue.issue_number || ''}.pdf`}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                <FileText className="w-4 h-4" /> Свали корица (PDF)
              </a>
            )}
            <button onClick={toggleIssueArchived}
              title={issue.archived_at ? 'Върни броя в началната страница' : 'Скрий броя от началната страница (нищо не се изтрива)'}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              {issue.archived_at
                ? <><ArchiveRestore className="w-4 h-4" /> Върни от архива</>
                : <><Archive className="w-4 h-4" /> Архивирай</>}
            </button>
          </div>
        </div>

        {issue.archived_at && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-6 text-sm">
            <Archive className="w-4 h-4 shrink-0" />
            Този брой е в архива и не се показва в началната страница. Можеш да го редактираш и сваляш както обикновено.
          </div>
        )}

        {/* Cover */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
          <div className="w-20 aspect-[210/297] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
            {issue.cover_image_url ? <img src={issue.cover_image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
          </div>
          <div className="flex gap-2">
            <button onClick={() => imgInput.current?.click()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Качи корица (снимка)</button>
            <button onClick={() => pdfInput.current?.click()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Качи корица (PDF)</button>
            <button onClick={() => setPicking('cover')} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <LibraryBig className="w-4 h-4" /> Корица от библиотека
            </button>
            <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => onCover(e.target.files?.[0], 'cover_image_url')} />
            <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => onCover(e.target.files?.[0], 'cover_pdf_url')} />
          </div>
        </div>

        {/* Items (articles + ads) */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Съдържание на броя ({items.length})</h2>
          <div className="flex gap-2">
            <button onClick={() => adInput.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <ImageIcon className="w-4 h-4" /> {uploading ? 'Качвам…' : '+ Реклама (снимка)'}
            </button>
            <input ref={adInput} type="file" accept="image/*" className="hidden" onChange={(e) => onAd(e.target.files?.[0])} />
            <button onClick={() => setPicking('ad')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <LibraryBig className="w-4 h-4" /> Реклама от библиотека
            </button>
            <button onClick={() => navigate(`/new?issue=${issue.id}`)} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              <Plus className="w-4 h-4" /> Нова статия
            </button>
          </div>
        </div>
        {items.length > 1 && (
          <p className="text-xs text-gray-400 mb-2">Хвани <GripVertical className="w-3 h-3 inline -mt-0.5" /> и влачи, за да преместиш статия или реклама на друго място.</p>
        )}
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-gray-400 py-8 text-center">Още няма съдържание в този брой.</div>}
          {items.map((it, idx) => (
            <div key={it.id} data-issue-row
              onDragOver={(e) => onRowDragOver(e, idx)}
              onDrop={onRowDrop}
              className={`relative bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 ${dragId === it.id ? 'opacity-40' : ''}`}>
              {/* Drop marker, drawn in the gap above or below the row */}
              {dragId && dropAt?.idx === idx && dragId !== it.id && (
                <div className={`absolute left-0 right-0 h-0.5 bg-[#007daa] rounded pointer-events-none ${dropAt.after ? '-bottom-[5px]' : '-top-[5px]'}`} />
              )}
              {/* Only the handle starts a drag, so the link field and buttons keep working normally. */}
              <span draggable title="Влачи, за да преместиш"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', it.id); // Firefox won't start a drag without data
                  const row = e.currentTarget.closest<HTMLElement>('[data-issue-row]');
                  if (row) e.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
                  setDragId(it.id);
                }}
                onDragEnd={endDrag}
                className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 -ml-1">
                <GripVertical className="w-4 h-4" />
              </span>
              <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
              {it.kind === 'insert' ? (
                <>
                  <img src={it.image_url} alt="" className="w-10 h-14 object-contain bg-gray-50 rounded border border-gray-100" />
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className="text-sm text-gray-500 italic shrink-0">Реклама</span>
                    <label className="flex-1 min-w-0 flex items-center gap-1.5 border border-gray-200 rounded px-2 py-1 focus-within:ring-1 focus-within:ring-gray-300">
                      <Link2 className={`w-3.5 h-3.5 shrink-0 ${it.link_url ? 'text-[#007daa]' : 'text-gray-300'}`} />
                      <input type="url" key={it.link_url ?? ''} defaultValue={it.link_url ?? ''}
                        onBlur={(e) => saveAdLink(it.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="Линк при клик върху рекламата (https://...)"
                        className="flex-1 min-w-0 text-xs text-gray-700 bg-transparent focus:outline-none" />
                    </label>
                  </div>
                </>
              ) : (
                <span className="flex-1 text-sm text-gray-900 truncate">{it.title || 'Без заглавие'}</span>
              )}
              <button disabled={idx === 0} onClick={() => move(it.id, 'up')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button disabled={idx === items.length - 1} onClick={() => move(it.id, 'down')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              {it.kind === 'article' ? (
                <>
                  <button onClick={() => navigate(`/edit/${it.id}`)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Отвори</button>
                  <button onClick={() => window.open(`/render?id=${it.id}`, '_blank')} className="px-3 py-1.5 text-sm text-[#007daa] hover:bg-gray-50 rounded flex items-center gap-1"><Download className="w-3.5 h-3.5" /> PDF</button>
                  <div className="relative">
                    <button onClick={() => setDupMenuFor(dupMenuFor === it.id ? null : it.id)}
                      title="Дублирай в друг брой"
                      className="px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1"><Copy className="w-3.5 h-3.5" /></button>
                    {dupMenuFor === it.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[200px]">
                        <div className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider">Дублирай в брой</div>
                        {allIssues.filter((iss) => iss.id !== issue.id).map((iss) => (
                          <button key={iss.id} onClick={() => handleDuplicate(it.id, iss.id)}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 truncate">
                            {iss.issue_number ? `Брой ${iss.issue_number} · ` : ''}{iss.name}
                            {iss.archived_at && <span className="text-gray-400"> (архив)</span>}
                          </button>
                        ))}
                        {allIssues.filter((iss) => iss.id !== issue.id).length === 0 && (
                          <div className="px-3 py-1.5 text-xs text-gray-400">Няма други броеве</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleArchive(it.id)}
                    title="Архивирай (премахни от броя)"
                    className="px-2 py-1.5 text-sm text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded flex items-center gap-1"><Archive className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <button onClick={() => removeAd(it.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Изтрий</button>
              )}
            </div>
          ))}
        </div>
      </main>
      {picking && (
        <MediaLibraryModal
          title={picking === 'ad' ? 'Избери реклама от библиотеката' : 'Избери корица от библиотеката'}
          onPick={onPickFromLibrary}
          onClose={() => setPicking(null)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
