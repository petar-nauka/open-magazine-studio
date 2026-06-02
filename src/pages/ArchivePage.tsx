import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Tag,
  Pencil,
  Plus,
  Loader2,
  FolderOpen,
  Search,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
  issue_number: number | null;
  description: string;
  published_at: string | null;
  created_at: string;
}

interface ArticleSummary {
  id: string;
  title: string;
  author: string | null;
  status: string;
  tags: string[];
  category_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function ArchivePage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNumber, setNewCategoryNumber] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [articlesRes, categoriesRes] = await Promise.all([
        supabase
          .from('mag_pdf_articles')
          .select('id, title, author, status, tags, category_id, sort_order, created_at, updated_at')
          .order('created_at', { ascending: false }),
        supabase.from('mag_pdf_categories').select('*').order('issue_number', { ascending: false }),
      ]);

      if (articlesRes.data) setArticles(articlesRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (err) {
      console.error('Failed to load archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase.from('mag_pdf_categories').insert({
        name: newCategoryName.trim(),
        issue_number: newCategoryNumber ? parseInt(newCategoryNumber) : null,
      });

      if (error) throw error;
      setNewCategoryName('');
      setNewCategoryNumber('');
      setShowNewCategory(false);
      loadData();
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || a.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const uncategorized = filteredArticles.filter((a) => !a.category_id);
  const categorized = categories
    .map((cat) => ({
      ...cat,
      articles: filteredArticles.filter((a) => a.category_id === cat.id),
    }))
    .filter((cat) => cat.articles.length > 0 || selectedCategory === cat.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Начало
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <h1 className="text-sm font-semibold text-gray-900">Архив</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{articles.length} статии</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Search + filter bar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Търси по заглавие или таг..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
            />
          </div>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <option value="">Всички броеве</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.issue_number ? `#${cat.issue_number} - ` : ''}{cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-8">
          {/* Left: categories sidebar */}
          <aside className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Броеве / Категории
                </h2>
                <button
                  onClick={() => setShowNewCategory(!showNewCategory)}
                  className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {showNewCategory && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Име (напр. Януари 2026)"
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-200"
                  />
                  <input
                    type="number"
                    value={newCategoryNumber}
                    onChange={(e) => setNewCategoryNumber(e.target.value)}
                    placeholder="Номер на брой"
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-200"
                  />
                  <button
                    onClick={handleCreateCategory}
                    className="w-full px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                  >
                    Създай
                  </button>
                </div>
              )}

              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-1 ${
                  !selectedCategory ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 inline mr-2" />
                Всички ({articles.length})
              </button>

              {categories.map((cat) => {
                const count = articles.filter((a) => a.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-1 ${
                      selectedCategory === cat.id
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-mono text-gray-400 mr-1.5">
                      {cat.issue_number ? `#${cat.issue_number}` : '-'}
                    </span>
                    {cat.name}
                    <span className="ml-auto text-gray-400 float-right">{count}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: articles list */}
          <div className="flex-1 min-w-0">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Няма намерени статии</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Добави нова
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Categorized groups */}
                {categorized.map((group) => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-gray-400 font-mono">
                        #{group.issue_number || '?'}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-800">{group.name}</h3>
                      <div className="flex-1 h-px bg-gray-200 ml-2" />
                    </div>
                    <div className="space-y-2">
                      {group.articles.map((article) => (
                        <ArticleRow
                          key={article.id}
                          article={article}
                          onEdit={() => navigate(`/edit/${article.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Uncategorized */}
                {uncategorized.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-500">Без категория</h3>
                      <div className="flex-1 h-px bg-gray-200 ml-2" />
                    </div>
                    <div className="space-y-2">
                      {uncategorized.map((article) => (
                        <ArticleRow
                          key={article.id}
                          article={article}
                          onEdit={() => navigate(`/edit/${article.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ArticleRow({ article, onEdit }: { article: ArticleSummary; onEdit: () => void }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-amber-50 text-amber-700',
    ready: 'bg-emerald-50 text-emerald-700',
    exported: 'bg-blue-50 text-blue-700',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Чернова',
    ready: 'Готова',
    exported: 'Експортирана',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-4 hover:border-gray-300 transition-colors group">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">{article.title || 'Без заглавие'}</h4>
        <div className="flex items-center gap-3 mt-1">
          {article.author && (
            <span className="text-[10px] text-gray-500">{article.author}</span>
          )}
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(article.created_at).toLocaleDateString('bg-BG')}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColors[article.status] || 'bg-gray-50 text-gray-600'}`}>
            {statusLabels[article.status] || article.status}
          </span>
        </div>
        {article.tags && article.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Tag className="w-3 h-3 text-gray-400" />
            {article.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                {tag}
              </span>
            ))}
            {article.tags.length > 4 && (
              <span className="text-[10px] text-gray-400">+{article.tags.length - 4}</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onEdit}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
      >
        <Pencil className="w-3.5 h-3.5" />
        Редактирай
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
