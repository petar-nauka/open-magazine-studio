import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Loader2, ImageOff, AlertTriangle, Check } from 'lucide-react';
import {
  loadLibrary,
  deleteImages,
  unusedImages,
  totalSize,
  formatSize,
  imageLabel,
  usageLines,
  isDeletable,
  thumbUrl,
  type LibraryImage,
} from '../lib/media-library';

type Filter = 'all' | 'used' | 'unused';

interface Props {
  // When given, clicking a thumbnail picks that image and closes the modal.
  // Without it the library is browse-and-manage only.
  onPick?: (url: string) => void;
  onClose: () => void;
  title?: string;
}

// One tile. Loads the resized thumbnail and silently falls back to the full-size
// image if the render endpoint is unavailable.
function Tile({ img, onPick, onDelete }: {
  img: LibraryImage;
  onPick?: (url: string) => void;
  onDelete: (img: LibraryImage) => void;
}) {
  const [src, setSrc] = useState(thumbUrl(img.path));
  const used = !isDeletable(img);

  return (
    <div className="group relative">
      <button
        onClick={() => onPick?.(img.url)}
        disabled={!onPick}
        className={`block w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-colors ${
          onPick ? 'border-transparent hover:border-[#007daa] cursor-pointer' : 'border-transparent cursor-default'
        }`}
        title={onPick ? 'Избери тази снимка' : imageLabel(img)}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setSrc(img.url)}
          className="w-full h-full object-cover"
        />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(img); }}
        className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-white/90 text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
        title={used ? 'Ползва се — виж къде' : 'Изтрий'}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="mt-1">
        <p className={`text-[11px] leading-tight line-clamp-2 ${used ? 'text-gray-600' : 'text-amber-700'}`}>
          {imageLabel(img)}
        </p>
        <p className="text-[10px] text-gray-400">{formatSize(img.size)}</p>
      </div>
    </div>
  );
}

export function MediaLibraryModal({ onPick, onClose, title = 'Библиотека със снимки' }: Props) {
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [issueFilter, setIssueFilter] = useState<string>('all');
  // A single image the user asked to delete (confirm or refuse), or 'bulk' for
  // the "delete all unused" flow.
  const [pending, setPending] = useState<LibraryImage | 'bulk' | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setError(null);
    try {
      setImages(await loadLibrary());
    } catch (e) {
      setError(String(e));
      setImages([]);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Escape closes — but only when no confirmation is open, so a stray keypress
  // can't dismiss the dialog and the modal in one go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pending) setPending(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, onClose]);

  // Memoised so the derived lists below aren't recomputed on every render.
  const all = useMemo(() => images ?? [], [images]);
  const unused = useMemo(() => unusedImages(all), [all]);

  const issues = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of all) {
      for (const u of img.usages) {
        if (u.issueId && u.issueLabel) map.set(u.issueId, u.issueLabel);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].localeCompare(a[1]));
  }, [all]);

  const visible = useMemo(() => {
    let list = all;
    if (filter === 'used') list = list.filter((i) => !isDeletable(i));
    if (filter === 'unused') list = unusedImages(list);
    if (issueFilter !== 'all') list = list.filter((i) => i.usages.some((u) => u.issueId === issueFilter));
    return list;
  }, [all, filter, issueFilter]);

  const runDelete = async (paths: string[]) => {
    setBusy(true);
    try {
      await deleteImages(paths);
      setPending(null);
      await refresh();
    } catch (e) {
      setError('Изтриването не успя: ' + String(e));
    } finally {
      setBusy(false);
    }
  };

  const chip = (f: Filter, label: string, n: number) => (
    <button
      onClick={() => setFilter(f)}
      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
        filter === f ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label} {n}
    </button>
  );

  // Rendered through a portal into <body>. The call sites sit inside the article
  // sidebar and the block editor, both of which are `sticky` + `overflow-y-auto`:
  // a sticky element always creates its own stacking context, so a `fixed z-50`
  // child is confined to it and the later <main> (the preview, its own sticky
  // context) painted straight over the modal. The portal escapes every ancestor
  // stacking context and scroll container at once. z-60 keeps it above the AI
  // chat panel and toasts, which both sit at z-50.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">
              {images === null ? 'Зареждам…' : `${all.length} снимки · ${formatSize(totalSize(all))}`}
              {onPick && images !== null && ' · кликни снимка, за да я избереш'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          {chip('all', 'Всички', all.length)}
          {chip('used', 'Ползвани', all.length - unused.length)}
          {chip('unused', 'Неползвани', unused.length)}
          {issues.length > 0 && (
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="ml-2 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
            >
              <option value="all">Всички броеве</option>
              {issues.map(([id, label]) => (<option key={id} value={id}>{label}</option>))}
            </select>
          )}
          {unused.length > 0 && (
            <button
              onClick={() => { setFilter('unused'); setIssueFilter('all'); setPending('bulk'); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Изтрий всички неползвани ({unused.length} · {formatSize(totalSize(unused))})
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-3 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>
          )}
          {images === null ? (
            <div className="h-40 flex items-center justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2">
              <ImageOff className="w-7 h-7" />
              <p className="text-sm">Няма снимки по този филтър.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {visible.map((img) => (
                <Tile key={img.path} img={img} onPick={onPick} onDelete={setPending} />
              ))}
            </div>
          )}
        </div>

        {/* Confirmations */}
        {pending === 'bulk' && (
          <div className="border-t border-red-200 bg-red-50 px-5 py-4 flex items-center gap-4">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1 text-sm text-red-900">
              <p className="font-medium">
                Ще изтрия {unused.length} неползвани снимки ({formatSize(totalSize(unused))}).
              </p>
              <p className="text-xs text-red-700">
                Това са снимките, показани сега. Изтриването е безвъзвратно.
              </p>
            </div>
            <button
              onClick={() => setPending(null)}
              disabled={busy}
              className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Отказ
            </button>
            <button
              onClick={() => runDelete(unused.map((i) => i.path))}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Изтрий {unused.length}
            </button>
          </div>
        )}

        {pending && pending !== 'bulk' && (
          <div className={`border-t px-5 py-4 flex items-start gap-4 ${isDeletable(pending) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              <img src={thumbUrl(pending.path, 120)} alt="" className="w-full h-full object-cover" />
            </div>
            {isDeletable(pending) ? (
              <>
                <div className="flex-1 text-sm text-red-900">
                  <p className="font-medium">Да изтрия ли тази снимка?</p>
                  <p className="text-xs text-red-700">Не се ползва никъде. Изтриването е безвъзвратно.</p>
                </div>
                <button onClick={() => setPending(null)} disabled={busy} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Отказ</button>
                <button onClick={() => runDelete([pending.path])} disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Изтрий
                </button>
              </>
            ) : (
              <>
                {/* Refusal: the same file is referenced elsewhere, so deleting it
                    would leave a hole in an already-finished issue. */}
                <div className="flex-1 text-sm text-amber-900">
                  <p className="font-medium">Не мога да я изтрия — ползва се:</p>
                  <ul className="mt-1 text-xs text-amber-800 list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {usageLines(pending).map((l, i) => (<li key={i}>{l}</li>))}
                  </ul>
                  <p className="text-xs text-amber-700 mt-1.5">Махни я оттам първо, после я изтрий тук.</p>
                </div>
                <button onClick={() => setPending(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Разбрах</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
