import type { Align } from '../design-system/alignment';

export interface RichSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ContentBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'pull_quote' | 'ad';
  content: string;
  position: number;
  metadata: {
    level?: number;
    bold?: boolean;
    italic?: boolean;
    richSegments?: RichSegment[];
    imageWidth?: number;
    imageHeight?: number;
    imageAspect?: 'landscape' | 'portrait' | 'square';
    span?: 'column' | 'full';
    adMode?: 'column' | 'full' | 'page';
    href?: string;
    originalSrc?: string;
    align?: Align;
  };
}

// How wide an image renders in the two-column body: 'column' (one column) or
// 'full' (spanning both). When the user has not chosen explicitly, fall back to
// a smart default by aspect — portrait stays in-column (tall images that span
// full width waste space and force page breaks), landscape/square span full.
export function effectiveSpan(block: ContentBlock): 'column' | 'full' {
  if (block.metadata.span) return block.metadata.span;
  return block.metadata.imageAspect === 'portrait' ? 'column' : 'full';
}

export interface ParsedArticle {
  title: string;
  blocks: ContentBlock[];
}

let blockIdCounter = 0;

function generateId(): string {
  return `block_${Date.now()}_${blockIdCounter++}`;
}

function getImageAspect(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  const ratio = width / height;
  if (ratio > 1.2) return 'landscape';
  if (ratio < 0.8) return 'portrait';
  return 'square';
}

// Determine bold/italic for an element, given the flags inherited from its
// ancestors. Inline `style` wins over the tag name, because Google Docs wraps
// pasted content in <b style="font-weight:normal"> and similar — trusting the
// tag alone would mark everything bold.
function resolveFlags(
  el: Element,
  inherited: { bold: boolean; italic: boolean }
): { bold: boolean; italic: boolean } {
  let { bold, italic } = inherited;
  const tag = el.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') bold = true;
  if (tag === 'i' || tag === 'em') italic = true;

  const style = el.getAttribute('style') || '';
  const fw = /font-weight\s*:\s*(\d+|bold|bolder|normal|lighter)/i.exec(style);
  if (fw) {
    const v = fw[1].toLowerCase();
    bold = v === 'bold' || v === 'bolder' || parseInt(v, 10) >= 600;
  }
  const fs = /font-style\s*:\s*(italic|oblique|normal)/i.exec(style);
  if (fs) {
    italic = fs[1].toLowerCase() !== 'normal';
  }
  return { bold, italic };
}

// Walk a paragraph's DOM into a flat list of {text, bold, italic} segments,
// merging adjacent runs that share the same formatting.
function extractSegments(node: Node, inherited: { bold: boolean; italic: boolean }, out: RichSegment[]): void {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (!text) continue;
      const last = out[out.length - 1];
      if (last && !!last.bold === inherited.bold && !!last.italic === inherited.italic) {
        last.text += text;
      } else {
        out.push({ text, bold: inherited.bold || undefined, italic: inherited.italic || undefined });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const flags = resolveFlags(child as Element, inherited);
      extractSegments(child, flags, out);
    }
  }
}

// Build rich segments for a block; returns undefined when the paragraph carries
// no formatting (so plain blocks stay lightweight).
function buildRichSegments(el: Element): RichSegment[] | undefined {
  const segments: RichSegment[] = [];
  extractSegments(el, { bold: false, italic: false }, segments);
  // Normalize whitespace-only leading/trailing handled by caller's trim of content;
  // keep segments as-is but drop if nothing is actually formatted.
  const hasFormatting = segments.some((s) => s.bold || s.italic);
  if (!hasFormatting) return undefined;
  return segments.filter((s) => s.text.length > 0);
}

// Google Docs wraps the whole pasted document in <b style="font-weight:normal">
// (and browsers may keep block elements nested inside it). Hoist the children of
// any top-level inline wrapper that contains block content, so the real
// paragraphs become top-level and get parsed instead of silently dropped.
const BLOCK_SELECTOR = 'p,div,h1,h2,h3,ul,ol,blockquote,table,img';
function unwrapInlineWrappers(body: HTMLElement): void {
  const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'FONT', 'A', 'SPAN']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of Array.from(body.children)) {
      if (INLINE.has(child.tagName) && child.querySelector(BLOCK_SELECTOR)) {
        while (child.firstChild) body.insertBefore(child.firstChild, child);
        body.removeChild(child);
        changed = true;
      }
    }
  }
}

export function parseHtmlContent(html: string): ParsedArticle {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: ContentBlock[] = [];
  let position = 0;
  let title = '';

  unwrapInlineWrappers(doc.body);
  const elements = doc.body.children;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const tagName = el.tagName.toLowerCase();

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      const text = el.textContent?.trim() || '';
      if (!text) continue;

      if (!title && (tagName === 'h1' || tagName === 'h2')) {
        title = text;
      }

      blocks.push({
        id: generateId(),
        type: 'heading',
        content: text,
        position: position++,
        metadata: { level: parseInt(tagName[1]) },
      });
    } else if (tagName === 'p' || tagName === 'div' || tagName === 'span') {
      const images = el.querySelectorAll('img');
      if (images.length > 0) {
        images.forEach((img) => {
          const src = img.getAttribute('src') || '';
          const width = parseInt(img.getAttribute('width') || '800');
          const height = parseInt(img.getAttribute('height') || '600');

          blocks.push({
            id: generateId(),
            type: 'image',
            content: src,
            position: position++,
            metadata: {
              imageWidth: width,
              imageHeight: height,
              imageAspect: getImageAspect(width, height),
              originalSrc: src,
            },
          });
        });
      }

      const text = el.textContent?.trim() || '';
      if (text) {
        if (!title && text.length < 120) {
          title = text;
          blocks.push({
            id: generateId(),
            type: 'heading',
            content: text,
            position: position++,
            metadata: { level: 1 },
          });
        } else {
          const richSegments = buildRichSegments(el);
          blocks.push({
            id: generateId(),
            type: 'text',
            content: text,
            position: position++,
            metadata: {
              bold: richSegments?.every((s) => s.bold) || undefined,
              italic: richSegments?.every((s) => s.italic) || undefined,
              richSegments,
            },
          });
        }
      }
    } else if (tagName === 'img') {
      const src = el.getAttribute('src') || '';
      const width = parseInt(el.getAttribute('width') || '800');
      const height = parseInt(el.getAttribute('height') || '600');

      blocks.push({
        id: generateId(),
        type: 'image',
        content: src,
        position: position++,
        metadata: {
          imageWidth: width,
          imageHeight: height,
          imageAspect: getImageAspect(width, height),
          originalSrc: src,
        },
      });
    } else if (tagName === 'ul' || tagName === 'ol') {
      const items = el.querySelectorAll('li');
      items.forEach((li) => {
        const text = li.textContent?.trim() || '';
        if (text) {
          blocks.push({
            id: generateId(),
            type: 'text',
            content: `${tagName === 'ol' ? '•' : '•'} ${text}`,
            position: position++,
            metadata: {},
          });
        }
      });
    } else if (tagName === 'blockquote') {
      const text = el.textContent?.trim() || '';
      if (text) {
        blocks.push({
          id: generateId(),
          type: 'pull_quote',
          content: text,
          position: position++,
          metadata: {},
        });
      }
    } else if (tagName === 'table') {
      const imgs = el.querySelectorAll('img');
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || '';
        const width = parseInt(img.getAttribute('width') || '800');
        const height = parseInt(img.getAttribute('height') || '600');
        blocks.push({
          id: generateId(),
          type: 'image',
          content: src,
          position: position++,
          metadata: {
            imageWidth: width,
            imageHeight: height,
            imageAspect: getImageAspect(width, height),
            originalSrc: src,
          },
        });
      });

      const cells = el.querySelectorAll('td, th');
      cells.forEach((cell) => {
        const text = cell.textContent?.trim() || '';
        if (text && !cell.querySelector('img')) {
          blocks.push({
            id: generateId(),
            type: 'text',
            content: text,
            position: position++,
            metadata: {},
          });
        }
      });
    }
  }

  if (!title && blocks.length > 0) {
    const firstText = blocks.find((b) => b.type === 'text' || b.type === 'heading');
    if (firstText) {
      title = firstText.content.slice(0, 80);
    }
  }

  return { title: title || 'Untitled Article', blocks };
}

export function parsePlainText(text: string): ParsedArticle {
  const lines = text.split('\n').filter((line) => line.trim());
  const blocks: ContentBlock[] = [];
  let position = 0;
  let title = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!title && trimmed.length < 120) {
      title = trimmed;
      blocks.push({
        id: generateId(),
        type: 'heading',
        content: trimmed,
        position: position++,
        metadata: { level: 1 },
      });
    } else {
      blocks.push({
        id: generateId(),
        type: 'text',
        content: trimmed,
        position: position++,
        metadata: {},
      });
    }
  }

  return { title: title || 'Untitled Article', blocks };
}
