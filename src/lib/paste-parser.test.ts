import { describe, it, expect } from 'vitest';
import { parseHtmlContent, effectiveSpan, effectiveImageSize, reconcileRichSegments, type ContentBlock } from './paste-parser';

function imageBlock(meta: ContentBlock['metadata']): ContentBlock {
  return { id: 'x', type: 'image', content: 'a.jpg', position: 0, metadata: meta };
}

describe('effectiveSpan', () => {
  it('honours an explicit span over the aspect-based guess', () => {
    expect(effectiveSpan(imageBlock({ span: 'column', imageAspect: 'landscape' }))).toBe('column');
    expect(effectiveSpan(imageBlock({ span: 'full', imageAspect: 'portrait' }))).toBe('full');
  });

  it('defaults portrait images to a single column', () => {
    expect(effectiveSpan(imageBlock({ imageAspect: 'portrait' }))).toBe('column');
  });

  it('defaults landscape/square/unknown images to full width', () => {
    expect(effectiveSpan(imageBlock({ imageAspect: 'landscape' }))).toBe('full');
    expect(effectiveSpan(imageBlock({ imageAspect: 'square' }))).toBe('full');
    expect(effectiveSpan(imageBlock({}))).toBe('full');
  });

  it('defaults text blocks to a single column, full only when chosen', () => {
    const text = (meta: ContentBlock['metadata']): ContentBlock =>
      ({ id: 't', type: 'text', content: 'x', position: 0, metadata: meta });
    expect(effectiveSpan(text({}))).toBe('column');
    expect(effectiveSpan(text({ span: 'full' }))).toBe('full');
  });
});

describe('effectiveImageSize', () => {
  it('honours an explicit size', () => {
    expect(effectiveImageSize(imageBlock({ imageSize: 'sm' }))).toBe('sm');
    expect(effectiveImageSize(imageBlock({ imageSize: 'lg', imageAspect: 'landscape' }))).toBe('lg');
    expect(effectiveImageSize(imageBlock({ imageSize: 'wide', imageAspect: 'landscape' }))).toBe('wide');
  });

  it('defaults to full width, except portrait images which stay in-column (md)', () => {
    expect(effectiveImageSize(imageBlock({ imageAspect: 'landscape' }))).toBe('full');
    expect(effectiveImageSize(imageBlock({ imageAspect: 'square' }))).toBe('full');
    expect(effectiveImageSize(imageBlock({}))).toBe('full');
    // a tall portrait would overflow the page at full width, so it stays in-column
    expect(effectiveImageSize(imageBlock({ imageAspect: 'portrait' }))).toBe('md');
    // an explicit size always wins, even for a portrait
    expect(effectiveImageSize(imageBlock({ imageSize: 'full', imageAspect: 'portrait' }))).toBe('full');
  });
});

describe('reconcileRichSegments', () => {
  it('leaves plain blocks untouched (no richSegments)', () => {
    const meta = { align: 'left' as const };
    expect(reconcileRichSegments('нов текст', meta)).toBe(meta);
  });

  it('keeps a uniformly italic block italic with the new text', () => {
    const meta: ContentBlock['metadata'] = {
      italic: true,
      richSegments: [{ text: 'стар надпис', italic: true }],
    };
    const next = reconcileRichSegments('нов надпис', meta);
    expect(next.richSegments).toEqual([{ text: 'нов надпис', italic: true, bold: undefined }]);
    expect(next.italic).toBe(true);
  });

  it('drops stale mixed-formatting segments so the new plain text renders', () => {
    const meta: ContentBlock['metadata'] = {
      richSegments: [
        { text: 'Така ' },
        { text: 'Каблешков', bold: true },
        { text: ' описва.' },
      ],
    };
    const next = reconcileRichSegments('Съвсем нов текст без форматиране.', meta);
    expect(next.richSegments).toBeUndefined();
  });
});

describe('parseHtmlContent — inline formatting', () => {
  // A leading heading "uses up" the title slot so the formatted paragraphs that
  // follow are parsed as body text (matching a real article layout).
  const TITLE = `<h1>Тодор Каблешков — гласът на свободата</h1>`;

  it('captures an italic paragraph from Google Docs inline styles', () => {
    // Google Docs wraps pasted content in <b style="font-weight:normal"> and
    // expresses italic/bold via inline span styles, not <i>/<b> tags.
    const html = `
      ${TITLE}
      <b style="font-weight:normal;">
        <p dir="ltr"><span style="font-style:italic;">Каблешков избухна една вечер тук и разклати всичко като тръбен звук, делото се поде.</span></p>
      </b>`;
    const { blocks } = parseHtmlContent(html);
    const body = blocks.find((b) => b.type === 'text' && b.content.includes('Каблешков'));
    expect(body?.metadata.richSegments).toBeDefined();
    expect(body?.metadata.richSegments!.every((s) => s.italic)).toBe(true);
    // The font-weight:normal wrapper must NOT mark the text bold.
    expect(body?.metadata.italic).toBe(true);
    expect(body?.metadata.bold).toBeUndefined();
  });

  it('captures an inline bold word inside an otherwise plain paragraph', () => {
    const html = `
      ${TITLE}
      <p dir="ltr"><span>Така Иван Вазов описва </span><span style="font-weight:700;">Тодор Каблешков</span><span> — един от най-ярките дейци на националноосвободителното движение.</span></p>`;
    const { blocks } = parseHtmlContent(html);
    const body = blocks.find((b) => b.type === 'text' && b.content.includes('Каблешков'))!;
    const segs = body.metadata.richSegments!;
    expect(segs).toBeDefined();
    const boldSeg = segs.find((s) => s.bold);
    expect(boldSeg?.text).toContain('Тодор Каблешков');
    // Surrounding text stays plain; the block as a whole is not all-bold.
    expect(body.metadata.bold).toBeUndefined();
    expect(segs.some((s) => !s.bold)).toBe(true);
  });

  it('leaves plain paragraphs without richSegments', () => {
    const html = `${TITLE}<p>Съвсем обикновен абзац без никакво форматиране, който е достатъчно дълъг да е тяло.</p>`;
    const { blocks } = parseHtmlContent(html);
    const body = blocks.find((b) => b.type === 'text' && b.content.includes('обикновен'))!;
    expect(body.metadata.richSegments).toBeUndefined();
  });

  it('still honours legacy <i> and <strong> tags', () => {
    const html = `${TITLE}<p>Това е <em>важно</em> и <strong>силно</strong> твърдение, което заслужава внимание от читателя.</p>`;
    const { blocks } = parseHtmlContent(html);
    const body = blocks.find((b) => b.type === 'text')!;
    const segs = body.metadata.richSegments!;
    expect(segs.find((s) => s.italic)?.text).toBe('важно');
    expect(segs.find((s) => s.bold)?.text).toBe('силно');
  });
});
