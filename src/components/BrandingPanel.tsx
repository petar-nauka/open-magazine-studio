import { useState } from 'react';
import { Image, Link, Type, ChevronDown, ChevronRight } from 'lucide-react';
import type { BrandingConfig } from '../lib/layout-engine';

interface BrandingPanelProps {
  branding: BrandingConfig;
  onChange: (branding: BrandingConfig) => void;
}

export function BrandingPanel({ branding, onChange }: BrandingPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const update = (field: keyof BrandingConfig, value: string) => {
    onChange({ ...branding, [field]: value });
  };

  return (
    <div className="border-t border-gray-100 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3 w-full text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Брандиране
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
              <Image className="w-3.5 h-3.5" />
              Лого URL
            </label>
            <input
              type="text"
              value={branding.logoUrl}
              onChange={(e) => update('logoUrl', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            {branding.logoUrl && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <img
                  src={branding.logoUrl}
                  alt="Logo preview"
                  className="h-8 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Header text */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
              <Type className="w-3.5 h-3.5" />
              Хедър текст
            </label>
            <input
              type="text"
              value={branding.headerText}
              onChange={(e) => update('headerText', e.target.value)}
              placeholder="Име на изданието"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* Footer text */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
              <Type className="w-3.5 h-3.5" />
              Футър текст
            </label>
            <input
              type="text"
              value={branding.footerText}
              onChange={(e) => update('footerText', e.target.value)}
              placeholder="Copyright 2026"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* Footer link */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
              <Link className="w-3.5 h-3.5" />
              Линк (футър)
            </label>
            <input
              type="text"
              value={branding.footerLink}
              onChange={(e) => update('footerLink', e.target.value)}
              placeholder="https://mysite.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 mb-2"
            />
            <input
              type="text"
              value={branding.footerLinkLabel}
              onChange={(e) => update('footerLinkLabel', e.target.value)}
              placeholder="Текст на линка (напр. mysite.com)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}
