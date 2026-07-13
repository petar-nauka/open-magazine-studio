import { describe, it, expect } from 'vitest';
import { parseAssistantReply, applyProposals } from './ai-commands';
import type { ContentBlock } from './paste-parser';

const block = (id: string, type: ContentBlock['type'], content: string, metadata: ContentBlock['metadata'] = {}): ContentBlock =>
  ({ id, type, content, position: 0, metadata });

describe('parseAssistantReply', () => {
  it('връща целия текст без предложения, когато няма команден блок', () => {
    const raw = 'Статията е добре структурирана. Бих съкратил въведението.';
    expect(parseAssistantReply(raw)).toEqual({ display: raw, proposals: [] });
  });

  it('изважда команден блок и го маха от показвания текст', () => {
    const raw = [
      'Ето по-кратко въведение:',
      '```commands',
      '{"commands":[{"action":"rewrite","id":"b1","text":"Ново въведение."}]}',
      '```',
    ].join('\n');
    const { display, proposals } = parseAssistantReply(raw);
    expect(display).toBe('Ето по-кратко въведение:');
    expect(proposals).toEqual([{ blockId: 'b1', text: 'Ново въведение.' }]);
  });

  it('приема и ```json етикет, голи масиви и единичен обект', () => {
    const arr = parseAssistantReply('```json\n[{"action":"rewrite","id":"a","text":"х"}]\n```');
    expect(arr.proposals).toEqual([{ blockId: 'a', text: 'х' }]);

    const single = parseAssistantReply('```\n{"action":"rewrite","id":"a","text":"х"}\n```');
    expect(single.proposals).toEqual([{ blockId: 'a', text: 'х' }]);
  });

  it('оставя обикновени кодови блокове и счупен JSON в текста', () => {
    const code = 'Пример:\n```js\nconsole.log(1);\n```';
    expect(parseAssistantReply(code)).toEqual({ display: code, proposals: [] });

    const broken = '```commands\n{"commands":[{]}\n```';
    expect(parseAssistantReply(broken).proposals).toEqual([]);
    expect(parseAssistantReply(broken).display).toBe(broken);
  });

  it('филтрира невалидни записи и събира от няколко блока', () => {
    const raw = [
      'Двe промени:',
      '```commands',
      '{"commands":[{"action":"rewrite","id":"b1","text":"Първа."},{"action":"delete","id":"b2"},{"action":"rewrite","id":"","text":"без id"}]}',
      '```',
      'И още една:',
      '```commands',
      '{"commands":[{"action":"rewrite","id":"b3","text":"Втора."}]}',
      '```',
    ].join('\n');
    const { display, proposals } = parseAssistantReply(raw);
    expect(proposals).toEqual([
      { blockId: 'b1', text: 'Първа.' },
      { blockId: 'b3', text: 'Втора.' },
    ]);
    expect(display).toBe('Двe промени:\n\nИ още една:');
  });
});

describe('applyProposals', () => {
  it('прилага по id и не пипа останалите блокове', () => {
    const blocks = [block('b1', 'text', 'старо'), block('b2', 'text', 'друго')];
    const next = applyProposals(blocks, [{ blockId: 'b1', text: 'ново' }]);
    expect(next[0].content).toBe('ново');
    expect(next[1]).toBe(blocks[1]);
    expect(blocks[0].content).toBe('старо'); // оригиналът е непокътнат
  });

  it('пропуска липсващи блокове и снимки/реклами', () => {
    const blocks = [
      block('img', 'image', 'https://x/снимка.jpg'),
      block('ad', 'ad', 'https://x/ad.png'),
      block('t', 'text', 'текст'),
    ];
    const next = applyProposals(blocks, [
      { blockId: 'img', text: 'не!' },
      { blockId: 'ad', text: 'не!' },
      { blockId: 'няма', text: 'не!' },
    ]);
    expect(next).toEqual(blocks);
  });

  it('съгласува форматирането: смесени сегменти се махат, за да се вижда новият текст', () => {
    const blocks = [
      block('b1', 'text', 'Така Каблешков описва.', {
        richSegments: [{ text: 'Така ' }, { text: 'Каблешков', bold: true }, { text: ' описва.' }],
      }),
    ];
    const next = applyProposals(blocks, [{ blockId: 'b1', text: 'Съвсем нов текст.' }]);
    expect(next[0].content).toBe('Съвсем нов текст.');
    expect(next[0].metadata.richSegments).toBeUndefined();
  });
});
