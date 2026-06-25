import { describe, it, expect } from 'vitest';
import { docxXmlToHtml } from './docx-parser';
import { parseHtmlContent } from './paste-parser';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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
