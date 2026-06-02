import type { ContentBlock } from './paste-parser';

export type PageLayout = 'hero-top' | 'two-column' | 'full-width' | 'sidebar-image' | 'text-dense';

export interface PageConfig {
  id: string;
  layout: PageLayout;
  blocks: ContentBlock[];
  pullQuote?: string;
}

export interface BrandingConfig {
  headerText: string;
  footerText: string;
  footerLink: string;
  footerLinkLabel: string;
  logoUrl: string;
}

export interface MagazineLayout {
  pages: PageConfig[];
  font: string;
  accentColor: string;
  branding: BrandingConfig;
}

const TARGET_TEXT_CHARS_PER_PAGE = 1800;
const MAX_IMAGES_PER_PAGE = 2;

export function getDefaultBranding(): BrandingConfig {
  return {
    headerText: '',
    footerText: '',
    footerLink: '',
    footerLinkLabel: '',
    logoUrl: '',
  };
}

export function generateLayout(blocks: ContentBlock[], branding?: BrandingConfig): MagazineLayout {
  const pages: PageConfig[] = [];
  let pageIndex = 0;

  const remaining = [...blocks];

  // First page: hero layout
  if (remaining.length > 0) {
    const heroBlocks: ContentBlock[] = [];
    let charCount = 0;
    let imageCount = 0;

    while (remaining.length > 0) {
      const next = remaining[0];

      if (next.type === 'image') {
        if (imageCount >= 1) break;
        heroBlocks.push(remaining.shift()!);
        imageCount++;
        continue;
      }

      if (next.type === 'heading') {
        heroBlocks.push(remaining.shift()!);
        charCount += next.content.length * 3;
        continue;
      }

      if (charCount + next.content.length > TARGET_TEXT_CHARS_PER_PAGE * 0.7) break;
      heroBlocks.push(remaining.shift()!);
      charCount += next.content.length;
    }

    if (heroBlocks.length > 0) {
      pages.push({
        id: `page_${pageIndex++}`,
        layout: 'hero-top',
        blocks: heroBlocks,
      });
    }
  }

  // Remaining pages: distribute by character count
  while (remaining.length > 0) {
    const pageBlocks: ContentBlock[] = [];
    let charCount = 0;
    let imageCount = 0;
    let hasImage = false;

    while (remaining.length > 0) {
      const next = remaining[0];

      if (next.type === 'image') {
        if (imageCount >= MAX_IMAGES_PER_PAGE) break;
        // An image "costs" roughly 600 chars of space
        if (charCount > TARGET_TEXT_CHARS_PER_PAGE * 0.6 && imageCount > 0) break;
        pageBlocks.push(remaining.shift()!);
        imageCount++;
        charCount += 600;
        hasImage = true;
        continue;
      }

      if (next.type === 'heading') {
        // Don't break before a heading if page is nearly full
        if (charCount > TARGET_TEXT_CHARS_PER_PAGE * 0.85 && pageBlocks.length > 2) break;
        pageBlocks.push(remaining.shift()!);
        charCount += next.content.length * 2;
        continue;
      }

      // Text block
      if (charCount + next.content.length > TARGET_TEXT_CHARS_PER_PAGE && pageBlocks.length > 0) break;
      pageBlocks.push(remaining.shift()!);
      charCount += next.content.length;
    }

    if (pageBlocks.length === 0) break;

    // Choose layout based on content
    let layout: PageLayout;
    const imageBlock = pageBlocks.find((b) => b.type === 'image');

    if (hasImage && imageBlock?.metadata.imageAspect === 'portrait') {
      layout = 'sidebar-image';
    } else if (hasImage && imageCount === 1) {
      layout = 'full-width';
    } else if (!hasImage && charCount > TARGET_TEXT_CHARS_PER_PAGE * 0.8) {
      layout = 'text-dense';
    } else {
      layout = 'two-column';
    }

    // Extract pull quote from longer text blocks
    const pullQuoteBlock = pageBlocks.find(
      (b) => b.type === 'text' && b.content.length > 80 && b.content.length < 250
    );

    pages.push({
      id: `page_${pageIndex++}`,
      layout,
      blocks: pageBlocks,
      pullQuote: layout === 'two-column' || layout === 'text-dense' ? pullQuoteBlock?.content : undefined,
    });
  }

  return {
    pages,
    font: 'Georgia',
    accentColor: '#1a5f3a',
    branding: branding || getDefaultBranding(),
  };
}
