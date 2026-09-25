import type { Align } from '../design-system/alignment';

export interface RichSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
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
    imageSize?: 'sm' | 'md' | 'lg' | 'wide' | 'full';
    adMode?: 'column' | 'full' | 'page';
    href?: string; // image/ad block: where a click leads (stays a link in the PDF)
    originalSrc?: string;
    align?: Align;
  };
}

// How wide a block renders in the two-column body: 'column' (one column) or
// 'full' (spanning both). An explicit choice always wins. Otherwise images get
// a smart default by aspect — portrait stays in-column (tall full-width images
// waste space and force page breaks), landscape/square span full — while text
// and everything else default to flowing within a single column.
export function effectiveSpan(block: ContentBlock): 'column' | 'full' {
  if (block.metadata.span) return block.metadata.span;
  if (block.type === 'image') {
    return block.metadata.imageAspect === 'portrait' ? 'column' : 'full';
  }
  return 'column';
}

// An image picks one of five sizes. sm/md/lg flow in one column with growing
// height caps. 'wide' spans both columns but is height-capped and centred — a
// middle ground that fits a shallow leftover space instead of jumping to a new
// page. 'full' spans both columns at natural height (banners/infographics).
//
// Default is FULL width — the uniform magazine look the editor asked for, so
// photos don't have to be enlarged one by one. The one exception is PORTRAIT
// images: at full text width a tall portrait would be taller than the page and
// break the layout, so portraits stay in-column (medium) by default. Any image
// can still be set to a smaller size (or a portrait forced to 'full') per image.
export function effectiveImageSize(block: ContentBlock): 'sm' | 'md' | 'lg' | 'wide' | 'full' {
  if (block.metadata.imageSize) return block.metadata.imageSize;
  if (block.metadata.imageAspect === 'portrait') return 'md';
  return 'full';
}

// The renderer prefers a block's richSegments (its inline bold/italic runs) over
// the plain `content`. The block editor edits only plain text, so after an edit
// the stale richSegments would keep showing the OLD words. Reconcile the segments
// with the new text: a uniformly bold/italic block keeps that styling via a single
// segment; any other block drops its now-stale segments so the new text renders.
export function reconcileRichSegments(
  text: string,
  meta: ContentBlock['metadata']
): ContentBlock['metadata'] {
  if (!meta.richSegments) return meta;
  if (meta.bold || meta.italic) {
    return { ...meta, richSegments: [{ text, bold: meta.bold, italic: meta.italic }] };
  }
  const next = { ...meta };
  delete next.richSegments;
  return next;
}

// Remove the leading '• ' marker from a bullet block's segments so the renderer
// (which draws its own bullet via CSS) doesn't show it twice. Whitespace-only
// segments before the marker are skipped.
export function stripBulletPrefix(segments: RichSegment[]): RichSegment[] {
  const result = [...segments];
  for (let i = 0; i < result.length; i++) {
    const t = result[i].text;
    if (!t.trim()) continue;
    result[i] = { ...result[i], text: t.replace(/^\s*•\s*/, '') };
    break;
  }
  return result;
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
type InlineFlags = { bold: boolean; italic: boolean; underline: boolean; href?: string };

function resolveFlags(el: Element, inherited: InlineFlags): InlineFlags {
  let { bold, italic, underline, href } = inherited;
  const tag = el.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') bold = true;
  if (tag === 'i' || tag === 'em') italic = true;
  if (tag === 'u') underline = true;
  if (tag === 'a') {
    const h = el.getAttribute('href');
    if (h) href = h;
  }

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
  const td = /text-decoration(?:-line)?\s*:\s*([^;]+)/i.exec(style);
  if (td) {
    underline = /underline/i.test(td[1]);
  }
  return { bold, italic, underline, href };
}

// True when a segment already carries exactly the given inline formatting, so
// an adjacent text run can be merged into it instead of starting a new segment.
function sameFlags(seg: RichSegment, f: InlineFlags): boolean {
  return (
    !!seg.bold === f.bold &&
    !!seg.italic === f.italic &&
    !!seg.underline === f.underline &&
    (seg.href || undefined) === (f.href || undefined)
  );
}

// Walk a paragraph's DOM into a flat list of formatted segments, merging
// adjacent runs that share the same formatting. When `breaks` is true (editing
// a contentEditable, where the browser wraps new lines in <br>/<div>), those
// boundaries are turned into newlines so multi-line edits survive; the paste
// path leaves it off to keep its output identical.
function extractSegments(node: Node, inherited: InlineFlags, out: RichSegment[], breaks = false): void {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (!text) continue;
      const last = out[out.length - 1];
      if (last && sameFlags(last, inherited)) {
        last.text += text;
      } else {
        out.push({
          text,
          bold: inherited.bold || undefined,
          italic: inherited.italic || undefined,
          underline: inherited.underline || undefined,
          href: inherited.href || undefined,
        });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const elc = child as Element;
      if (breaks) {
        const last = out[out.length - 1];
        if (elc.tagName === 'BR') {
          if (last) last.text += '\n';
          continue;
        }
        // A block child (new line in contentEditable) starts on its own line.
        if ((elc.tagName === 'DIV' || elc.tagName === 'P') && last && !last.text.endsWith('\n')) {
          last.text += '\n';
        }
      }
      const flags = resolveFlags(elc, inherited);
      extractSegments(child, flags, out, breaks);
    }
  }
}

// Build rich segments for a block; returns undefined when the paragraph carries
// no formatting (so plain blocks stay lightweight).
function buildRichSegments(el: Element): RichSegment[] | undefined {
  const segments: RichSegment[] = [];
  extractSegments(el, { bold: false, italic: false, underline: false }, segments);
  // Normalize whitespace-only leading/trailing handled by caller's trim of content;
  // keep segments as-is but drop if nothing is actually formatted.
  const hasFormatting = segments.some((s) => s.bold || s.italic || s.underline || s.href);
  if (!hasFormatting) return undefined;
  return segments.filter((s) => s.text.length > 0);
}

// --- Editor bridge: convert between rich segments and editable HTML ----------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Serialize segments into HTML for a contentEditable field. Uses semantic tags
// (<strong>/<em>/<u>/<a>) that both the browser's execCommand and our own
// extractSegments understand, so editing round-trips cleanly. Newlines become
// <br> so multi-line blocks keep their shape.
export function richSegmentsToHtml(segments: RichSegment[] | undefined, fallbackText: string): string {
  const segs = segments && segments.length ? segments : [{ text: fallbackText }];
  return segs
    .map((s) => {
      let html = escapeHtml(s.text).replace(/\n/g, '<br>') || '<br>';
      if (s.bold) html = `<strong>${html}</strong>`;
      if (s.italic) html = `<em>${html}</em>`;
      if (s.underline) html = `<u>${html}</u>`;
      if (s.href) html = `<a href="${escapeHtml(s.href).replace(/"/g, '&quot;')}">${html}</a>`;
      return html;
    })
    .join('');
}

// Read the current DOM of a contentEditable back into plain text + segments.
// Returns segments only when something is actually formatted, so unformatted
// blocks stay lightweight (mirrors buildRichSegments / reconcileRichSegments).
export function domToSegments(el: HTMLElement): { text: string; segments?: RichSegment[] } {
  const out: RichSegment[] = [];
  extractSegments(el, { bold: false, italic: false, underline: false }, out, true);
  const segs = out.filter((s) => s.text.length > 0);
  const text = segs.map((s) => s.text).join('');
  const hasFormatting = segs.some((s) => s.bold || s.italic || s.underline || s.href);
  return { text, segments: hasFormatting ? segs : undefined };
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

  const pushImageBlock = (img: Element) => {
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
  };

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const tagName = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tagName)) {
      const text = el.textContent?.trim() || '';

      if (text) {
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
      }

      // Google Docs anchors an image on the heading's own line inside the
      // <h*> element — extract it (after the heading) instead of dropping it.
      el.querySelectorAll('img').forEach(pushImageBlock);
    } else if (tagName === 'p' || tagName === 'div' || tagName === 'span') {
      el.querySelectorAll('img').forEach(pushImageBlock);

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
      pushImageBlock(el);
    } else if (tagName === 'ul' || tagName === 'ol') {
      const items = el.querySelectorAll('li');
      items.forEach((li) => {
        const text = li.textContent?.trim() || '';
        if (text) {
          // Keep the item's inline bold/italic (Google Docs bullets often lead
          // with a bold term). The '• ' marker is part of the content, so it
          // becomes a plain first segment to keep content and segments in sync.
          const liSegments = buildRichSegments(li);
          blocks.push({
            id: generateId(),
            type: 'text',
            content: `• ${text}`,
            position: position++,
            metadata: liSegments ? { richSegments: [{ text: '• ' }, ...liSegments] } : {},
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
      el.querySelectorAll('img').forEach(pushImageBlock);

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

  normalizeHeadingLevels(blocks);
  return { title: title || 'Untitled Article', blocks };
}

// Word/Google Docs sources often mark every subheading with the same style (the
// .docx importer defaults them all to level 2), losing the section/subsection
// hierarchy. When the source draws no distinction, split by lettercase: ALL-CAPS
// headings are section heads (level 2), the rest subsections (level 3). Sources
// that already distinguish levels are respected untouched, and the article
// title (a leading level-1 heading) never takes part.
export function normalizeHeadingLevels(blocks: ContentBlock[]): void {
  const headings = blocks.filter((b) => b.type === 'heading');
  const subs = (headings[0]?.metadata.level ?? 2) === 1 ? headings.slice(1) : headings;
  const levels = new Set(subs.map((b) => b.metadata.level ?? 2));
  if (levels.size !== 1) return;
  for (const b of subs) {
    b.metadata.level = isAllCaps(b.content) ? 2 : 3;
  }
}

// True when the text is entirely uppercase AND actually contains cased letters
// (digits/punctuation alone don't count).
function isAllCaps(text: string): boolean {
  return text === text.toUpperCase() && text !== text.toLowerCase();
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
