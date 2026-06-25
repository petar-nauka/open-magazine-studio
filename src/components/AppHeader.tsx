import { Link } from 'react-router-dom';
import { Archive, Settings } from 'lucide-react';

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20 print:hidden">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/brand/logo-09.png" alt="БГ Наука" className="w-8 h-8 rounded-lg" />
          <span className="text-base font-bold text-gray-900">Magazine Studio</span>
        </Link>
        <div className="flex items-center gap-2">
          {right}
          <Link to="/archive" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><Archive className="w-4 h-4" /> Всички броеве</Link>
          <Link to="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><Settings className="w-4 h-4" /> Настройки</Link>
        </div>
      </div>
    </header>
  );
}
