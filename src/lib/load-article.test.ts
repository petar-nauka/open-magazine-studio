import { describe, it, expect } from 'vitest';
import { rowsToArticleDoc, type ArticleRow, type BlockRow } from './load-article';

const article: ArticleRow = {
  title: 'Запазена статия',
  author: 'Иван Петров',
  layout_config: { accent: 'magenta' },
};

const blocks: BlockRow[] = [
  { id: 'b2', type: 'text', content: 'Втори абзац.', position: 1, metadata: null },
  { id: 'b1', type: 'heading', content: 'Запазена статия', position: 0, metadata: { level: 1 } },
  { id: 'b3', type: 'image', content: 'data:image/png;base64,xxx', position: 2, metadata: { imageAspect: 'landscape' } },
];

describe('rowsToArticleDoc', () => {
  it('maps title, author and accent from the rows', () => {
    const doc = rowsToArticleDoc(article, blocks);
    expect(doc.title).toBe('Запазена статия');
    expect(doc.author).toBe('Иван Петров');
    expect(doc.accent).toBe('magenta');
  });

  it('orders blocks by position and assigns roles', () => {
    const doc = rowsToArticleDoc(article, blocks);
    expect(doc.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(doc.blocks.every((b) => typeof b.role === 'string')).toBe(true);
  });

  it('defaults accent to teal and author to empty when missing', () => {
    const doc = rowsToArticleDoc({ title: 'X', author: null, layout_config: null }, []);
    expect(doc.accent).toBe('teal');
    expect(doc.author).toBe('');
  });

  it('treats null block metadata as empty', () => {
    const doc = rowsToArticleDoc(article, blocks);
    const second = doc.blocks.find((b) => b.id === 'b2');
    expect(second?.metadata).toEqual({});
  });

  it('reads align from layout_config (default justify)', () => {
    const withAlign = rowsToArticleDoc({ title: 'T', author: null, layout_config: { align: 'right' } }, []);
    expect(withAlign.align).toBe('right');
    const noAlign = rowsToArticleDoc({ title: 'T', author: null, layout_config: {} }, []);
    expect(noAlign.align).toBe('justify');
  });
});

const imageBlocks: BlockRow[] = [
  { id: 'i1', type: 'image', content: 'A.jpg', position: 0, metadata: {} },
  { id: 't1', type: 'text', content: 'Body', position: 1, metadata: {} },
];

describe('rowsToArticleDoc: dropCap & openerImage', () => {
  it('passes dropCap and openerImage through from layout_config', () => {
    const row: ArticleRow = {
      title: 'T',
      author: null,
      layout_config: { accent: 'teal', align: 'left', dropCap: false, openerImage: 'X.jpg' },
    };
    const doc = rowsToArticleDoc(row, imageBlocks);
    expect(doc.dropCap).toBe(false);
    expect(doc.openerImage).toBe('X.jpg');
  });

  it('defaults dropCap to true and openerImage to the first image when absent', () => {
    const row: ArticleRow = { title: 'T', author: null, layout_config: { accent: 'teal' } };
    const doc = rowsToArticleDoc(row, imageBlocks);
    expect(doc.dropCap).toBe(true);
    expect(doc.openerImage).toBe('A.jpg');
  });
});
