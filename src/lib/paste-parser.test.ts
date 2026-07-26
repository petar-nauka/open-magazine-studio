import { describe, it, expect } from 'vitest';
import { parseHtmlContent, effectiveSpan, effectiveImageSize, reconcileRichSegments, normalizeHeadingLevels, stripBulletPrefix, type ContentBlock } from './paste-parser';

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

describe('parseHtmlContent — снимки в заглавия', () => {
  it('извлича снимка, закотвена вътре в заглавие (Google Docs я слага в <h1>/<h2>)', () => {
    const html = `
      <h1>Заглавие на статията<img src="hero.png" width="800" height="500"></h1>
      <p>Първи абзац от текста на статията, достатъчно дълъг за тяло.</p>`;
    const { blocks } = parseHtmlContent(html);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].content).toBe('Заглавие на статията');
    const img = blocks.find((b) => b.type === 'image');
    expect(img?.content).toBe('hero.png');
    // снимката идва веднага след заглавието, преди текста
    expect(blocks[1].type).toBe('image');
  });

  it('не пропуска заглавие, което съдържа само снимка', () => {
    const html = `
      <h1>Заглавие на статията</h1>
      <h2><img src="under-title.png" width="600" height="400"></h2>
      <p>Абзац след снимката под заглавието, достатъчно дълъг за тяло.</p>`;
    const { blocks } = parseHtmlContent(html);
    const img = blocks.find((b) => b.type === 'image');
    expect(img?.content).toBe('under-title.png');
  });

  it('не губи h4–h6 заглавия и снимките в тях', () => {
    const html = `
      <h1>Заглавие на статията</h1>
      <h4>Подзаглавие четвърто ниво</h4>
      <p>Текст под подзаглавието, достатъчно дълъг да бъде тяло на статията.</p>`;
    const { blocks } = parseHtmlContent(html);
    const h4 = blocks.find((b) => b.type === 'heading' && b.content.includes('четвърто'));
    expect(h4).toBeDefined();
    // normalizeHeadingLevels пренарежда еднообразните поднива към 2/3
    expect(h4?.metadata.level).toBe(3);
  });
});

describe('parseHtmlContent — булети с форматиране', () => {
  const html = `
    <h1>Заглавие на статията</h1>
    <p>Основните дейности на агенцията включват следните направления на работа:</p>
    <ul>
      <li><p><span style="font-weight:700;">Разрешителен режим</span><span> – АЯР прилага система от лицензи и разрешения за всички дейности.</span></p></li>
      <li><p><span style="font-weight:700;">Регулаторен контрол</span><span> – Агенцията извършва независими проверки и инспекции.</span></p></li>
      <li><p><span>Обикновен булет без никакво форматиране в него.</span></p></li>
    </ul>`;

  it('запазва болда в булет елементи като richSegments', () => {
    const { blocks } = parseHtmlContent(html);
    const bullets = blocks.filter((b) => b.content.startsWith('•'));
    expect(bullets).toHaveLength(3);

    const segs = bullets[0].metadata.richSegments!;
    expect(segs).toBeDefined();
    // Съдържанието и сегментите остават съгласувани: '• ' е първият сегмент.
    expect(segs[0].text).toBe('• ');
    expect(segs.find((s) => s.bold)?.text).toContain('Разрешителен режим');
    expect(bullets[0].content).toContain('– АЯР прилага система');
  });

  it('булет без форматиране си остава лек (без richSegments)', () => {
    const { blocks } = parseHtmlContent(html);
    const plain = blocks.find((b) => b.content.includes('Обикновен булет'));
    expect(plain?.metadata.richSegments).toBeUndefined();
  });
});

describe('stripBulletPrefix', () => {
  it('маха водещото „• “ от първия непразен сегмент', () => {
    const segs = [{ text: '• ' }, { text: 'Разрешителен режим', bold: true }, { text: ' – описание' }];
    const out = stripBulletPrefix(segs);
    expect(out.map((s) => s.text).join('')).toBe('Разрешителен режим – описание');
    expect(out[1].bold).toBe(true);
  });

  it('не пипа сегменти без булет префикс', () => {
    const segs = [{ text: 'Без булет', bold: true }];
    expect(stripBulletPrefix(segs)).toEqual(segs);
  });
});

describe('normalizeHeadingLevels', () => {
  const heading = (content: string, level: number, id = content): ContentBlock =>
    ({ id, type: 'heading', content, position: 0, metadata: { level } });
  const levelsOf = (blocks: ContentBlock[]) =>
    blocks.filter((b) => b.type === 'heading').map((b) => b.metadata.level);

  it('разпределя по главни букви, когато всички подзаглавия са на едно ниво', () => {
    const blocks = [
      heading('Заглавие на статията', 1),
      heading('ВЕЛИКОБРИТАНИЯ', 2),
      heading('Правителствена политика', 2),
      heading('САЩ', 2),
      heading('Агенцията по храните и лекарствата (FDA)', 2),
    ];
    normalizeHeadingLevels(blocks);
    expect(levelsOf(blocks)).toEqual([1, 2, 3, 2, 3]);
  });

  it('уважава източник, който вече различава нива', () => {
    const blocks = [
      heading('Заглавие на статията', 1),
      heading('Първа секция', 2),
      heading('ПОДТОЧКА С ГЛАВНИ', 3),
    ];
    normalizeHeadingLevels(blocks);
    expect(levelsOf(blocks)).toEqual([1, 2, 3]);
  });

  it('не пипа заглавието на статията и работи без него', () => {
    const withTitle = [heading('ЗАГЛАВИЕ НА СТАТИЯТА', 1), heading('История', 2)];
    normalizeHeadingLevels(withTitle);
    expect(levelsOf(withTitle)).toEqual([1, 3]);

    const noTitle = [heading('ВЕЛИКОБРИТАНИЯ', 2), heading('История', 2)];
    normalizeHeadingLevels(noTitle);
    expect(levelsOf(noTitle)).toEqual([2, 3]);
  });

  it('текст без букви не се брои за главни букви', () => {
    const blocks = [heading('Заглавие на статията', 1), heading('2026', 2)];
    normalizeHeadingLevels(blocks);
    expect(levelsOf(blocks)).toEqual([1, 3]);
  });

  it('прилага се от parseHtmlContent (paste и .docx пътя)', () => {
    const html = '<h1>Заглавие на статията</h1><h2>САЩ</h2><h2>Национална академия</h2>';
    const { blocks } = parseHtmlContent(html);
    expect(levelsOf(blocks)).toEqual([1, 2, 3]);
  });
});
