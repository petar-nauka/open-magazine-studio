import { supabase } from './supabase';

// Subset of the branding settings that actually drives the live render. The
// settings page stores more (logo, palette), but only these fields are wired in.
export interface BrandingConfig {
  header?: { text?: string };
  footer?: { text?: string; links?: { label?: string; url?: string }[] };
  colors?: { accent?: string };
}

// Load the saved branding_config, or null. Tolerant: any read error / missing
// row yields null so the render falls back to magazine.css's built-in defaults.
export async function loadBranding(): Promise<BrandingConfig | null> {
  try {
    const { data } = await supabase
      .from('mag_pdf_app_settings')
      .select('value')
      .eq('key', 'branding_config')
      .maybeSingle();
    return (data?.value as BrandingConfig) ?? null;
  } catch {
    return null;
  }
}

// Apply branding to :root as the CSS variables the @page rules read. Each var is
// set only when its value is present, so unset fields keep magazine.css's
// fallbacks (i.e. no branding saved → the original БГ Наука header). Header/footer
// strings are quoted so they are valid CSS `content` values.
export function applyBrandingVars(b: BrandingConfig | null): void {
  const root = document.documentElement.style;
  const cssString = (s: string) => `"${s.replace(/["\\]/g, '\\$&')}"`;
  const headerLeft = b?.header?.text?.trim();
  const headerRight = b?.footer?.links?.find((l) => l.url?.trim())?.url?.trim();
  const footer = b?.footer?.text?.trim();
  const accent = b?.colors?.accent?.trim();
  if (headerLeft) root.setProperty('--brand-header-left', cssString(headerLeft));
  if (headerRight) root.setProperty('--brand-header-right', cssString(headerRight));
  if (footer) root.setProperty('--brand-footer', cssString(footer));
  if (accent) root.setProperty('--brand-accent', accent);
}
