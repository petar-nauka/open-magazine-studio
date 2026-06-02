import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowUp, ArrowDown, Download, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { loadIssue, setIssueCover, nextSortOrder, type Issue } from '../lib/issues';
import {
  loadInserts, addInsert, deleteInsert, reorderIssueItems, mergeIssueItems, type IssueItem,
} from '../lib/inserts';
import { compressDataUrl, uploadImage } from '../lib/image-upload';

export function IssuePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [items, setItems] = useState<IssueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const adInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    if (!id) return;
    Promise.all([loadIssue(id), loadInserts(id)])
      .then(([{ issue, articles }, inserts]) => {
        setIssue(issue);
        setItems(mergeIssueItems(articles, inserts));
      })
      .catch((e) => { console.error('Неуспешно зареждане на броя', e); });
  }, [id]);
  useEffect(refresh, [refresh]);

  const move = async (itemId: string, dir: 'up' | 'down') => {
    try {
      await reorderIssueItems(items, itemId, dir);
      refresh();
    } catch (e) {
      alert('Грешка при пренареждане: ' + String(e));
    }
  };

  const fileToDataUrl = (file: File) => new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
  });

  const onCover = async (file: File | undefined, field: 'cover_image_url' | 'cover_pdf_url') => {
    if (!file || !id) return;
    await setIssueCover(id, field, await fileToDataUrl(file));
    if (imgInput.current) imgInput.current.value = '';
    if (pdfInput.current) pdfInput.current.value = '';
    refresh();
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
      alert('Грешка при качване на рекламата: ' + String(e));
    } finally {
      setUploading(false);
      if (adInput.current) adInput.current.value = '';
    }
  };

  const removeAd = async (insertId: string) => {
    if (!window.confirm('Да изтрия ли тази реклама?')) return;
    try {
      await deleteInsert(insertId);
      refresh();
    } catch (e) {
      alert('Грешка при изтриване: ' + String(e));
    }
  };

  if (!issue) return <div className="min-h-screen bg-gray-50"><AppHeader /></div>;

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
          </div>
        </div>

        {/* Cover */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
          <div className="w-20 aspect-[210/297] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
            {issue.cover_image_url ? <img src={issue.cover_image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
          </div>
          <div className="flex gap-2">
            <button onClick={() => imgInput.current?.click()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Качи корица (снимка)</button>
            <button onClick={() => pdfInput.current?.click()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Качи корица (PDF)</button>
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
            <button onClick={() => navigate(`/new?issue=${issue.id}`)} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              <Plus className="w-4 h-4" /> Нова статия
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-gray-400 py-8 text-center">Още няма съдържание в този брой.</div>}
          {items.map((it, idx) => (
            <div key={it.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
              {it.kind === 'insert' ? (
                <>
                  <img src={it.image_url} alt="" className="w-10 h-14 object-contain bg-gray-50 rounded border border-gray-100" />
                  <span className="flex-1 text-sm text-gray-500 italic">Реклама</span>
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
                </>
              ) : (
                <button onClick={() => removeAd(it.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Изтрий</button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
