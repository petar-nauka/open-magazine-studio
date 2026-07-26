import { describe, it, expect } from 'vitest';
import { docxXmlToHtml, parseRelsXml } from './docx-parser';
import { parseHtmlContent } from './paste-parser';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

// Minimal WordprocessingML: a title, an all-italic paragraph, and a paragraph
// with one bold run in the middle — mirroring how Word stores character
// formatting per run (<w:r><w:rPr><w:b/>/<w:i/></w:rPr>).
const DOC_XML = `<?xml version="1.0"?>
<w:document xmlns:w="${W}">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Тодор Каблешков — гласът на свободата</w:t></w:r></w:p>
    <w:p>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Каблешков избухна една вечер тук и разклати всичко като тръбен звук.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Така Иван Вазов описва </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Тодор Каблешков</w:t></w:r>
      <w:r><w:t> — един от най-ярките дейци на движението.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

describe('docxXmlToHtml — run formatting', () => {
  it('emits inline styles for bold and italic runs', () => {
    const html = docxXmlToHtml(DOC_XML, new Map());
    expect(html).toContain('font-style:italic');
    expect(html).toContain('font-weight:700');
  });

  it('round-trips through parseHtmlContent into richSegments', () => {
    const html = docxXmlToHtml(DOC_XML, new Map());
    const { blocks } = parseHtmlContent(html);

    const italicBlock = blocks.find((b) => b.type === 'text' && b.content.includes('избухна'));
    expect(italicBlock?.metadata.richSegments?.every((s) => s.italic)).toBe(true);

    const boldBlock = blocks.find((b) => b.type === 'text' && b.content.includes('Иван Вазов'));
    const boldSeg = boldBlock?.metadata.richSegments?.find((s) => s.bold);
    expect(boldSeg?.text).toContain('Тодор Каблешков');
    // The surrounding text stays plain.
    expect(boldBlock?.metadata.bold).toBeUndefined();
  });
});

// Word/Google Docs mark list items with <w:numPr> in the paragraph properties —
// there is no <ul>/<li> in WordprocessingML. Dropping that marker turns bullets
// into plain paragraphs and loses the per-run bold of the lead-in words.
const LIST_DOC_XML = `<?xml version="1.0"?>
<w:document xmlns:w="${W}">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Заглавие на статията</w:t></w:r></w:p>
    <w:p><w:r><w:t>Основните дейности на агенцията включват:</w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Разрешителен режим</w:t></w:r>
      <w:r><w:t> – АЯР прилага система от лицензи и разрешения.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Регулаторен контрол</w:t></w:r>
      <w:r><w:t> – Агенцията извършва независими проверки.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Обикновен абзац след списъка.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

describe('docxXmlToHtml — списъци (numPr)', () => {
  it('превръща списъчните параграфи в <li> в общ <ul>', () => {
    const html = docxXmlToHtml(LIST_DOC_XML, new Map());
    expect((html.match(/<ul>/g) || []).length).toBe(1);
    expect((html.match(/<li>/g) || []).length).toBe(2);
    // обикновеният абзац след списъка е извън <ul>
    expect(html.indexOf('Обикновен абзац')).toBeGreaterThan(html.indexOf('</ul>'));
  });

  it('запазва болда на водещите думи вътре в <li>', () => {
    const html = docxXmlToHtml(LIST_DOC_XML, new Map());
    expect(html).toMatch(/<li>.*font-weight:700.*Разрешителен режим.*<\/li>/);
  });

  it('round-trip: булетите стават блокове с „• “ и болд сегменти', () => {
    const { blocks } = parseHtmlContent(docxXmlToHtml(LIST_DOC_XML, new Map()));
    const bullets = blocks.filter((b) => b.content.startsWith('•'));
    expect(bullets).toHaveLength(2);
    expect(bullets[0].metadata.richSegments?.find((s) => s.bold)?.text).toContain('Разрешителен режим');
  });
});

// Images in a .docx are referenced by relationship id (<a:blip r:embed="rIdN"/>),
// resolved through word/_rels/document.xml.rels — NOT by the order of the files
// in word/media/. The zip/media order routinely differs from document order
// (especially in Google Docs exports), so matching by index shuffles the photos.
const IMG_DOC_XML = `<?xml version="1.0"?>
<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:a="${A}">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Статия със снимки</w:t></w:r></w:p>
    <w:p><w:r><w:drawing><a:blip r:embed="rIdB"/></w:drawing></w:r></w:p>
    <w:p><w:r><w:t>Описание под първата снимка в документа.</w:t></w:r></w:p>
    <w:p><w:r>
      <w:drawing><a:blip r:embed="rIdA"/></w:drawing>
      <w:drawing><a:blip r:embed="rIdC"/></w:drawing>
    </w:r></w:p>
    <w:p><w:r><w:t>Финален абзац след двете снимки в един параграф.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const RELS_XML = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdA" Type="${R}/image" Target="media/imageA.png"/>
  <Relationship Id="rIdB" Type="${R}/image" Target="media/imageB.png"/>
  <Relationship Id="rIdC" Type="${R}/image" Target="media/imageC.png"/>
</Relationships>`;

// Zip/media order deliberately different from document order (A, B, C on disk;
// B, A, C in the document).
function mediaImages(): Map<string, string> {
  return new Map([
    ['imageA.png', 'data:image/png;base64,AAA'],
    ['imageB.png', 'data:image/png;base64,BBB'],
    ['imageC.png', 'data:image/png;base64,CCC'],
  ]);
}

describe('parseRelsXml', () => {
  it('maps relationship ids to their targets', () => {
    const rels = parseRelsXml(RELS_XML);
    expect(rels.get('rIdA')).toBe('media/imageA.png');
    expect(rels.get('rIdB')).toBe('media/imageB.png');
    expect(rels.get('rIdC')).toBe('media/imageC.png');
  });
});

describe('docxXmlToHtml — image order', () => {
  it('places images by their r:embed relationship, not by media-file order', () => {
    const html = docxXmlToHtml(IMG_DOC_XML, mediaImages(), parseRelsXml(RELS_XML));
    const srcs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs).toEqual([
      'data:image/png;base64,BBB',
      'data:image/png;base64,AAA',
      'data:image/png;base64,CCC',
    ]);
  });

  it('emits one <img> per drawing even when a paragraph holds several images', () => {
    const html = docxXmlToHtml(IMG_DOC_XML, mediaImages(), parseRelsXml(RELS_XML));
    const count = (html.match(/<img /g) || []).length;
    expect(count).toBe(3);
  });

  it('keeps the caption paragraph right after its image through parseHtmlContent', () => {
    const html = docxXmlToHtml(IMG_DOC_XML, mediaImages(), parseRelsXml(RELS_XML));
    const { blocks } = parseHtmlContent(html);
    const firstImg = blocks.findIndex((b) => b.type === 'image');
    expect(blocks[firstImg].content).toBe('data:image/png;base64,BBB');
    expect(blocks[firstImg + 1].type).toBe('text');
    expect(blocks[firstImg + 1].content).toContain('Описание под първата снимка');
  });

  it('does not append unreferenced media (e.g. header logos) when rels resolve', () => {
    const images = mediaImages();
    images.set('headerLogo.png', 'data:image/png;base64,LOGO');
    const html = docxXmlToHtml(IMG_DOC_XML, images, parseRelsXml(RELS_XML));
    expect(html).not.toContain('LOGO');
  });

  it('falls back to media order when no rels are available', () => {
    const html = docxXmlToHtml(IMG_DOC_XML, mediaImages());
    const srcs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
    // Legacy behaviour: sequential assignment, leftovers appended at the end.
    expect(srcs).toContain('data:image/png;base64,AAA');
    expect(srcs).toContain('data:image/png;base64,BBB');
    expect(srcs).toContain('data:image/png;base64,CCC');
  });
});
