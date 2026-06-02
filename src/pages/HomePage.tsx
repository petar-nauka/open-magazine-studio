import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { loadRecentIssues, createIssue, type Issue } from '../lib/issues';

export function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const navigate = useNavigate();

  useEffect(() => { loadRecentIssues(5).then(setIssues).catch(() => {}); }, []);

  const handleNewIssue = async () => {
    const name = window.prompt('Име на новия брой:');
    if (!name) return;
    try {
      const issue = await createIssue(name.trim());
      navigate(`/issue/${issue.id}`);
    } catch (e) { alert('Грешка при създаване: ' + String(e)); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Броеве</h1>
          <button onClick={handleNewIssue} className="flex items-center gap-2 px-4 py-2.5 bg-[#007daa] text-white rounded-xl font-medium hover:opacity-90">
            <Plus className="w-5 h-5" /> Нов брой
          </button>
        </div>
        {issues.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <BookOpen className="w-10 h-10 mx-auto mb-3" />
            Още няма броеве. Натисни „Нов брой", за да започнеш.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {issues.map((it) => (
              <button key={it.id} onClick={() => navigate(`/issue/${it.id}`)}
                className="text-left bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-[210/297] bg-gray-100 flex items-center justify-center">
                  {it.cover_image_url
                    ? <img src={it.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : <BookOpen className="w-8 h-8 text-gray-300" />}
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-400">{it.issue_number ? `Брой ${it.issue_number}` : '—'}</div>
                  <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
