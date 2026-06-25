import { describe, it, expect } from 'vitest';
import { articleFromParsed, findTitleBlock, type ArticleDoc } from './document-model';
import type { ParsedArticle } from './paste-parser';

describe('articleFromParsed — title source', () => {
  it('reads the title from the H1 block, not a drifted parsed.title', () => {
    const doc = articleFromParsed({
      title: 'СТАРО РАЗСИНХРОНИЗИРАНО ЗАГЛАВИЕ',
      blocks: [
        { id: 'h', type: 'heading', content: 'Правилното заглавие', position: 0, metadata: { level: 1 } },
        { id: 't', type: 'text', content: 'Тяло на статията.', position: 1, metadata: {} },
      ],
    });
    expect(doc.title).toBe('Правилното заглавие');
  });

  it('falls back to parsed.title when there is no H1 block', () => {
    const doc = articleFromParsed({
      title: 'Фолбек заглавие',
      blocks: [{ id: 't', type: 'text', content: 'Само тяло.', position: 0, metadata: {} }],
    });
    expect(doc.title).toBe('Фолбек заглавие');
  });

  it('findTitleBlock ignores a leading non-title heading (level 2)', () => {
    const blocks = [
      { id: 'h2', type: 'heading' as const, content: 'Подзаглавие', position: 0, metadata: { level: 2 } },
    ];
    expect(findTitleBlock(blocks)).toBeUndefined();
  });
});

const base: ParsedArticle = {
  title: 'T',
  blocks: [
    { id: 'i1', type: 'image', content: 'A.jpg', position: 0, metadata: {} },
    { id: 'i2', type: 'image', content: 'B.jpg', position: 1, metadata: {} },
    { id: 't1', type: 'text', content: 'Body text', position: 2, metadata: {} },
  ],
};

const parsed: ParsedArticle = {
  title: 'Тестова статия',
  blocks: [
    { id: 'b1', type: 'heading', content: 'Тестова статия', position: 0, metadata: { level: 1 } },
    { id: 'b2', type: 'text', content: 'Първи абзац от тялото на статията.', position: 1, metadata: {} },
    { id: 'b3', type: 'image', content: 'data:image/png;base64,xxx', position: 2, metadata: { imageAspect: 'landscape' } },
  ],
};

describe('articleFromParsed', () => {
  it('carries the title and author and a default accent', () => {
    const doc: ArticleDoc = articleFromParsed(parsed, { author: 'Доц. Иван', accent: 'teal' });
    expect(doc.title).toBe('Тестова статия');
    expect(doc.author).toBe('Доц. Иван');
    expect(doc.accent).toBe('teal');
  });

  it('keeps every block and assigns a role to each', () => {
    const doc = articleFromParsed(parsed);
    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks.every((b) => typeof b.role === 'string')).toBe(true);
  });

  it('defaults the accent to teal when not supplied', () => {
    expect(articleFromParsed(parsed).accent).toBe('teal');
  });
});

describe('articleFromParsed align', () => {
  it('defaults align to justify', () => {
    const doc = articleFromParsed({ title: 'T', blocks: [] });
    expect(doc.align).toBe('justify');
  });
  it('uses the provided align', () => {
    const doc = articleFromParsed({ title: 'T', blocks: [] }, { align: 'center' });
    expect(doc.align).toBe('center');
  });
});

describe('articleFromParsed: opener & drop cap', () => {
  it('defaults openerImage to the first image and dropCap to true', () => {
    const doc = articleFromParsed(base);
    expect(doc.openerImage).toBe('A.jpg');
    expect(doc.dropCap).toBe(true);
  });

  it('uses an explicit openerImage override', () => {
    const doc = articleFromParsed(base, { openerImage: 'B.jpg' });
    expect(doc.openerImage).toBe('B.jpg');
  });

  it('respects dropCap=false', () => {
    const doc = articleFromParsed(base, { dropCap: false });
    expect(doc.dropCap).toBe(false);
  });
});
