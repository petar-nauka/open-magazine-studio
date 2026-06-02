import { supabase } from './supabase';
import type { ParsedArticle } from './paste-parser';

// Images are imported as base64 data URLs. Storing those in the DB makes rows huge
// (and exceeds the server's request-size limit). Instead we compress each image and
// upload it to Supabase Storage, replacing the block content with a small public URL.

const BUCKET = 'mag_pdf_images';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

// Resize to fit within maxDim and re-encode as JPEG so each upload stays well under
// the server body-size limit (and the magazine PDF stays light).
export async function compressDataUrl(dataUrl: string, maxDim = 1800, quality = 0.82): Promise<Blob> {
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  const longest = Math.max(width, height) || 1;
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/jpeg', quality);
  });
}

export async function uploadImage(blob: Blob): Promise<string> {
  const path = `img/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Replace every base64-image block in the article with an uploaded Storage URL.
// Blocks whose content is already a URL (e.g. re-editing a saved article) are left as-is.
export async function uploadArticleImages(
  article: ParsedArticle,
  onProgress?: (done: number, total: number) => void
): Promise<ParsedArticle> {
  const blocks = [...article.blocks];
  const total = blocks.filter((b) => b.type === 'image' && b.content.startsWith('data:')).length;
  let done = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'image' && b.content.startsWith('data:')) {
      const blob = await compressDataUrl(b.content);
      const url = await uploadImage(blob);
      blocks[i] = { ...b, content: url, metadata: { ...b.metadata, originalSrc: url } };
      done++;
      onProgress?.(done, total);
    }
  }
  return { ...article, blocks };
}
