import { describe, it, expect } from 'vitest';
import { articleFromParsed, type ArticleDoc } from './document-model';
import type { ParsedArticle } from './paste-parser';

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
