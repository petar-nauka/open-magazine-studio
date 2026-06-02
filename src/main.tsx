import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AISettingsPage } from './pages/AISettingsPage.tsx';
import { BrandingSettingsPage } from './pages/BrandingSettingsPage.tsx';
import { SettingsLayout } from './pages/SettingsLayout.tsx';
import { ArchivePage } from './pages/ArchivePage.tsx';
import { EditArticlePage } from './pages/EditArticlePage.tsx';
import { RenderPage } from './pages/RenderPage.tsx';
import { IssuePage } from './pages/IssuePage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<App />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/branding" replace />} />
          <Route path="branding" element={<BrandingSettingsPage />} />
          <Route path="ai" element={<AISettingsPage />} />
        </Route>
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/edit/:id" element={<EditArticlePage />} />
        <Route path="/issue/:id" element={<IssuePage />} />
        <Route path="/render" element={<RenderPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
