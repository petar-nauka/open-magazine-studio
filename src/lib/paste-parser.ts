export interface ContentBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'pull_quote';
  content: string;
  position: number;
  metadata: {
    level?: number;
    bold?: boolean;
    italic?: boolean;
    imageWidth?: number;
    imageHeight?: number;
    imageAspect?: 'landscape' | 'portrait' | 'square';
    originalSrc?: string;
  };
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

export function parseHtmlContent(html: string): ParsedArticle {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: ContentBlock[] = [];
  let position = 0;
  let title = '';

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
          blocks.push({
            id: generateId(),
            type: 'text',
            content: text,
            position: position++,
            metadata: {
              bold: el.querySelector('b, strong') !== null,
              italic: el.querySelector('i, em') !== null,
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
