import { NavLink, Outlet } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';

export function SettingsLayout() {
  const tab = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
  const active = 'bg-gray-900 text-white';
  const idle = 'text-gray-600 hover:bg-gray-100';
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Настройки</h1>
        <div className="flex gap-2 mb-6">
          <NavLink to="/settings/branding" className={({ isActive }) => `${tab} ${isActive ? active : idle}`}>Брандиране</NavLink>
          <NavLink to="/settings/ai" className={({ isActive }) => `${tab} ${isActive ? active : idle}`}>AI</NavLink>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
