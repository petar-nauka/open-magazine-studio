import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, BookOpen, ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Toast } from '../components/Toast';
import {
  loadIssuesPage, countIssues, createIssue, pageCount, clampPage, pageWindow, issuesSearch,
  ISSUES_PAGE_SIZE, type Issue,
} from '../lib/issues';

export function HomePage() {
  // null = not loaded yet, so the empty state doesn't flash before the first answer.
  const [result, setResult] = useState<{ issues: Issue[]; total: number } | null>(null);
  // Tab labels. Kept apart from `result` so they don't blank out while a tab loads.
  const [counts, setCounts] = useState<{ active: number; archived: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();
  // Tab and page live in the URL (?view=archive&page=2) so going back from an
  // issue lands on the same tab and page.
  const [searchParams, setSearchParams] = useSearchParams();
  const archived = searchParams.get('view') === 'archive';
  const page = clampPage(Number(searchParams.get('page') ?? 1), Number.MAX_SAFE_INTEGER);

  useEffect(() => {
    let cancelled = false; // a slow answer for an old page must not overwrite the current one
    // The other tab's count is only for its label.
    Promise.all([loadIssuesPage(page, archived), countIssues(!archived)])
      .then(([r, otherTotal]) => {
        if (cancelled) return;
        const last = pageCount(r.total, ISSUES_PAGE_SIZE);
        if (page > last) { setSearchParams(issuesSearch({ archived, page: last }), { replace: true }); return; }
        setResult(r);
        setCounts(archived ? { active: otherTotal, archived: r.total } : { active: r.total, archived: otherTotal });
      })
      .catch((e) => { if (!cancelled) { console.error('Неуспешно зареждане на броевете', e); setLoadError(true); } });
    return () => { cancelled = true; };
  }, [page, archived, setSearchParams]);

  const goToPage = (p: number) => {
    setSearchParams(issuesSearch({ archived, page: p }));
    window.scrollTo({ top: 0 });
  };

  const handleNewIssue = async () => {
    const name = window.prompt('Име на новия брой:');
    if (!name) return;
    try {
      const issue = await createIssue(name.trim());
      navigate(`/issue/${issue.id}`);
    } catch (e) { setToast('Грешка при създаване: ' + String(e)); }
  };

  const totalPages = result ? pageCount(result.total, ISSUES_PAGE_SIZE) : 1;
  const firstShown = (page - 1) * ISSUES_PAGE_SIZE + 1;
  const lastShown = result ? firstShown + result.issues.length - 1 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Броеве</h1>
          <button onClick={handleNewIssue} className="flex items-center gap-2 px-4 py-2.5 bg-[#007daa] text-white rounded-xl font-medium hover:opacity-90">
            <Plus className="w-5 h-5" /> Нов брой
          </button>
        </div>
        <div className="flex gap-1 border-b border-gray-200 mb-6" role="tablist">
          {[
            { key: false, label: 'Активни', total: counts?.active },
            { key: true, label: 'Архив', total: counts?.archived },
          ].map((tab) => (
            <button key={tab.label} role="tab" aria-selected={archived === tab.key}
              onClick={() => { if (archived !== tab.key) { setResult(null); setSearchParams(issuesSearch({ archived: tab.key, page: 1 })); } }}
              className={`flex items-center gap-1.5 px-4 py-2 -mb-px text-sm border-b-2 ${archived === tab.key
                ? 'border-[#007daa] text-[#007daa] font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {tab.key && <Archive className="w-4 h-4" />}
              {tab.label}
              {tab.total != null && <span className="text-xs text-gray-400">({tab.total})</span>}
            </button>
          ))}
        </div>
        {loadError ? (
          <div className="text-center text-red-600 py-20">
            <p className="text-sm mb-3">Неуспешно зареждане на броевете. Провери връзката и опитай пак.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm bg-[#007daa] text-white rounded-lg hover:opacity-90">Презареди</button>
          </div>
        ) : !result ? null : result.issues.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            {archived ? (
              <>
                <Archive className="w-10 h-10 mx-auto mb-3" />
                Архивът е празен. Брой се праща тук с бутона „Архивирай“ в страницата му.
              </>
            ) : (
              <>
                <BookOpen className="w-10 h-10 mx-auto mb-3" />
                {counts && counts.archived > 0
                  ? 'Няма активни броеве — всички са в „Архив“. Натисни „Нов брой“, за да започнеш нов.'
                  : 'Още няма броеве. Натисни „Нов брой“, за да започнеш.'}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {result.issues.map((it) => (
                <button key={it.id} onClick={() => navigate(`/issue/${it.id}`)}
                  className="text-left bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-[210/297] bg-gray-100 flex items-center justify-center">
                    {it.cover_image_url
                      ? <img src={it.cover_image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <BookOpen className="w-8 h-8 text-gray-300" />}
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-gray-400">{it.issue_number ? `Брой ${it.issue_number}` : '—'}</div>
                    <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                  </div>
                </button>
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8" aria-label="Страници">
                <span className="text-sm text-gray-500">
                  {firstShown}–{lastShown} от {result.total} броя
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                    className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent">
                    <ChevronLeft className="w-4 h-4" /> Предишна
                  </button>
                  {pageWindow(page, totalPages).map((p, i) => p === 'gap' ? (
                    <span key={`gap-${i}`} className="px-2 text-sm text-gray-400">…</span>
                  ) : (
                    <button key={p} onClick={() => goToPage(p)} aria-current={p === page ? 'page' : undefined}
                      className={`min-w-9 px-3 py-2 text-sm rounded-lg ${p === page ? 'bg-[#007daa] text-white font-medium' : 'text-gray-700 hover:bg-gray-200'}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                    className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent">
                    Следваща <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </main>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
