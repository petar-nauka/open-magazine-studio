import { describe, it, expect } from 'vitest';
import { detectRole } from './role-detector';
import type { ContentBlock } from './paste-parser';

function block(partial: Partial<ContentBlock>): ContentBlock {
  return { id: 'x', type: 'text', content: '', position: 0, metadata: {}, ...partial };
}

describe('detectRole', () => {
  it('marks the first level-1 heading as title', () => {
    const b = block({ type: 'heading', content: 'Заглавие', metadata: { level: 1 } });
    expect(detectRole(b, [b], 0)).toBe('title');
  });

  it('marks a short uppercase heading as subheading', () => {
    const b = block({ type: 'heading', content: 'ДОПЪЛВАЩИ СЕ ВЗАИМОДЕЙСТВИЯ', metadata: { level: 2 } });
    const title = block({ type: 'heading', content: 'Заглавие', metadata: { level: 1 } });
    expect(detectRole(b, [title, b], 1)).toBe('subheading');
  });

  it('marks bullet text as bullet', () => {
    const b = block({ type: 'text', content: '• Бобови растения: ...' });
    expect(detectRole(b, [b], 0)).toBe('bullet');
  });

  it('marks images as image', () => {
    const b = block({ type: 'image', content: 'data:...' });
    expect(detectRole(b, [b], 0)).toBe('image');
  });

  it('marks blockquote-type blocks as pull_quote', () => {
    const b = block({ type: 'pull_quote', content: 'Цитат.' });
    expect(detectRole(b, [b], 0)).toBe('pull_quote');
  });

  it('marks everything after a sources heading as references', () => {
    const title = block({ type: 'heading', content: 'Заглавие', metadata: { level: 1 } });
    const src = block({ type: 'heading', content: 'Използвани източници', metadata: { level: 2 } });
    const ref = block({ type: 'text', content: 'Delwiche, J. (2004). ...' });
    const all = [title, src, ref];
    expect(detectRole(src, all, 1)).toBe('subheading');
    expect(detectRole(ref, all, 2)).toBe('references');
  });

  it('marks normal paragraphs as body', () => {
    const title = block({ type: 'heading', content: 'Заглавие', metadata: { level: 1 } });
    const p = block({ type: 'text', content: 'Това е нормален дълъг абзац от тялото на статията, който описва нещо.' });
    expect(detectRole(p, [title, p], 1)).toBe('body');
  });
});
