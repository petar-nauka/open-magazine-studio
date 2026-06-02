import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  Image,
  Link as LinkIcon,
  Type,
  Plus,
  X,
  Palette,
  PanelTop,
  PanelBottom,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface HeaderConfig {
  text: string;
  logoUrl: string;
  showOnAllPages: boolean;
}

interface FooterConfig {
  text: string;
  links: { label: string; url: string }[];
  showPageNumbers: boolean;
}

interface BrandingSettings {
  header: HeaderConfig;
  footer: FooterConfig;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
}

const DEFAULT_SETTINGS: BrandingSettings = {
  header: {
    text: '',
    logoUrl: '',
    showOnAllPages: true,
  },
  footer: {
    text: '',
    links: [],
    showPageNumbers: true,
  },
  colors: {
    primary: '#1a5f3a',
    secondary: '#1e3a5f',
    accent: '#0d5e5e',
    text: '#1f2937',
    background: '#ffffff',
  },
};

export function BrandingSettingsPage() {
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('mag_pdf_app_settings')
        .select('*')
        .eq('key', 'branding_config')
        .maybeSingle();

      if (data?.value) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.value });
      }
    } catch (err) {
      console.error('Failed to load branding settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const { error } = await supabase
        .from('mag_pdf_app_settings')
        .upsert(
          { key: 'branding_config', value: settings },
          { onConflict: 'key' }
        );

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save branding settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const addFooterLink = () => {
    setSettings((s) => ({
      ...s,
      footer: {
        ...s.footer,
        links: [...s.footer.links, { label: '', url: '' }],
      },
    }));
  };

  const removeFooterLink = (index: number) => {
    setSettings((s) => ({
      ...s,
      footer: {
        ...s.footer,
        links: s.footer.links.filter((_, i) => i !== index),
      },
    }));
  };

  const updateFooterLink = (index: number, field: 'label' | 'url', value: string) => {
    setSettings((s) => ({
      ...s,
      footer: {
        ...s.footer,
        links: s.footer.links.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
          {/* Header settings */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <PanelTop className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Хедър</h2>
                <p className="text-xs text-gray-500">Горна лента на всяка страница от списанието</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Image className="w-3.5 h-3.5" />
                  Лого URL
                </label>
                <input
                  type="text"
                  value={settings.header.logoUrl}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, header: { ...s.header, logoUrl: e.target.value } }))
                  }
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
                {settings.header.logoUrl && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg inline-block">
                    <img
                      src={settings.header.logoUrl}
                      alt="Logo preview"
                      className="h-10 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Type className="w-3.5 h-3.5" />
                  Заглавие на изданието
                </label>
                <input
                  type="text"
                  value={settings.header.text}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, header: { ...s.header, text: e.target.value } }))
                  }
                  placeholder="Моето Издание"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.header.showOnAllPages}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      header: { ...s.header, showOnAllPages: e.target.checked },
                    }))
                  }
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-200"
                />
                <span className="text-xs text-gray-600">Показвай хедъра на всички страници</span>
              </label>
            </div>
          </section>

          {/* Footer settings */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <PanelBottom className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Футър</h2>
                <p className="text-xs text-gray-500">Долна лента с информация и линкове</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Текст</label>
                <input
                  type="text"
                  value={settings.footer.text}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, footer: { ...s.footer, text: e.target.value } }))
                  }
                  placeholder="(c) 2026 Magazine Studio. Всички права запазени."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                    <LinkIcon className="w-3.5 h-3.5" />
                    Линкове
                  </label>
                  <button
                    onClick={addFooterLink}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добави
                  </button>
                </div>

                {settings.footer.links.length === 0 && (
                  <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                    Няма линкове. Натисни "Добави" за да добавиш.
                  </p>
                )}

                <div className="space-y-2">
                  {settings.footer.links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateFooterLink(index, 'label', e.target.value)}
                        placeholder="Етикет"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateFooterLink(index, 'url', e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 font-mono text-xs"
                      />
                      <button
                        onClick={() => removeFooterLink(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.footer.showPageNumbers}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      footer: { ...s.footer, showPageNumbers: e.target.checked },
                    }))
                  }
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-200"
                />
                <span className="text-xs text-gray-600">Показвай номер на страница</span>
              </label>
            </div>
          </section>

          {/* Color palette */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Цветова палитра</h2>
                <p className="text-xs text-gray-500">Основни цветове за списанието</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(settings.colors).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        colors: { ...s.colors, [key]: e.target.value },
                      }))
                    }
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-700 capitalize">
                      {key === 'primary' && 'Основен'}
                      {key === 'secondary' && 'Вторичен'}
                      {key === 'accent' && 'Акцентен'}
                      {key === 'text' && 'Текст'}
                      {key === 'background' && 'Фон'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Preview strip */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-xs font-medium text-gray-600">Превю</h3>
            </div>
            <div style={{ backgroundColor: settings.colors.background }}>
              {/* Mini header preview */}
              <div
                className="flex items-center justify-between px-6 py-2 border-b"
                style={{ borderColor: `${settings.colors.primary}30` }}
              >
                <div className="flex items-center gap-2">
                  {settings.header.logoUrl && (
                    <img src={settings.header.logoUrl} alt="" className="h-4 object-contain" />
                  )}
                  <span
                    className="text-[9px] font-semibold uppercase tracking-widest"
                    style={{ color: settings.colors.text }}
                  >
                    {settings.header.text || 'Име на изданието'}
                  </span>
                </div>
                <div className="w-6 h-0.5 rounded" style={{ backgroundColor: settings.colors.primary }} />
              </div>

              {/* Mini content preview */}
              <div className="px-6 py-6">
                <div className="w-32 h-1 rounded mb-2" style={{ backgroundColor: settings.colors.primary }} />
                <div className="w-48 h-2 rounded mb-1" style={{ backgroundColor: settings.colors.text, opacity: 0.8 }} />
                <div className="w-40 h-2 rounded mb-3" style={{ backgroundColor: settings.colors.text, opacity: 0.5 }} />
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="w-full h-1.5 rounded" style={{ backgroundColor: settings.colors.text, opacity: 0.15 }} />
                    <div className="w-full h-1.5 rounded" style={{ backgroundColor: settings.colors.text, opacity: 0.15 }} />
                    <div className="w-3/4 h-1.5 rounded" style={{ backgroundColor: settings.colors.text, opacity: 0.15 }} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="w-full h-1.5 rounded" style={{ backgroundColor: settings.colors.text, opacity: 0.15 }} />
                    <div className="w-full h-1.5 rounded" style={{ backgroundColor: settings.colors.text, opacity: 0.15 }} />
                    <div className="w-2/3 h-1.5 rounded" style={{ backgroundColor: settings.colors.text, opacity: 0.15 }} />
                  </div>
                </div>
              </div>

              {/* Mini footer preview */}
              <div
                className="flex items-center justify-between px-6 py-2 border-t"
                style={{ borderColor: `${settings.colors.primary}20` }}
              >
                <span className="text-[8px]" style={{ color: settings.colors.text, opacity: 0.5 }}>
                  {settings.footer.text || 'Footer text'}
                </span>
                <div className="flex items-center gap-3">
                  {settings.footer.links.map((link, i) => (
                    <span key={i} className="text-[8px]" style={{ color: settings.colors.accent }}>
                      {link.label || 'Link'}
                    </span>
                  ))}
                </div>
                {settings.footer.showPageNumbers && (
                  <span className="text-[8px]" style={{ color: settings.colors.text, opacity: 0.4 }}>
                    1
                  </span>
                )}
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Запазено!' : 'Запази'}
            </button>
          </div>
        </div>
  );
}
