import { parseHtmlContent, parsePlainText, type ParsedArticle } from './paste-parser';

export async function parseDocxFile(file: File): Promise<ParsedArticle> {
  const arrayBuffer = await file.arrayBuffer();
  const entries = readZipEntries(new Uint8Array(arrayBuffer));

  const docEntry = entries.find((e) => e.name === 'word/document.xml');
  if (!docEntry) {
    throw new Error('Invalid .docx file: no document.xml found');
  }

  const docXml = new TextDecoder().decode(docEntry.data);
  const images = extractImages(entries);
  const html = docxXmlToHtml(docXml, images);

  const article = parseHtmlContent(html);
  if (article.blocks.length === 0) {
    const plainText = extractPlainText(docXml);
    if (plainText.trim()) {
      return parsePlainText(plainText);
    }
  }

  return article;
}

function extractPlainText(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const texts: string[] = [];
  const allNodes = doc.querySelectorAll('*');

  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    if (node.localName === 't' && node.textContent) {
      texts.push(node.textContent);
    }
    if (node.localName === 'p' && texts.length > 0 && texts[texts.length - 1] !== '\n') {
      texts.push('\n');
    }
  }

  return texts.join('');
}

function extractImages(entries: ZipEntry[]): Map<string, string> {
  const imageMap = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.name.startsWith('word/media/')) continue;

    const ext = entry.name.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    const base64 = arrayBufferToBase64(entry.data);
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const fileName = entry.name.replace('word/media/', '');
    imageMap.set(fileName, dataUrl);
  }

  return imageMap;
}

export function docxXmlToHtml(xml: string, images: Map<string, string>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const htmlParts: string[] = [];
  let imageIndex = 0;
  const imageKeys = Array.from(images.keys());

  const allElements = doc.querySelectorAll('*');
  const pElements: Element[] = [];
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === 'p' && el.namespaceURI?.includes('wordprocessingml')) {
      pElements.push(el);
    }
  }

  for (const para of pElements) {
    let text = '';
    let hasImage = false;
    let styleVal = '';

    const allDesc = para.querySelectorAll('*');
    for (let i = 0; i < allDesc.length; i++) {
      const desc = allDesc[i];
      if (desc.localName === 'pStyle') {
        styleVal = desc.getAttribute('w:val') || desc.getAttribute('val') || '';
      }
      if (desc.localName === 't' && desc.textContent) {
        text += desc.textContent;
      }
      if (desc.localName === 'drawing' || desc.localName === 'pict' || desc.localName === 'blip') {
        hasImage = true;
      }
    }

    if (hasImage && imageIndex < imageKeys.length) {
      const src = images.get(imageKeys[imageIndex]) || '';
      htmlParts.push(`<img src="${src}" width="800" height="600" />`);
      imageIndex++;
    }

    if (!text.trim()) continue;

    if (styleVal.match(/heading/i) || styleVal.match(/^Heading/)) {
      const level = styleVal.match(/\d/) ? styleVal.match(/\d/)![0] : '2';
      htmlParts.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
    } else if (styleVal.match(/title/i)) {
      htmlParts.push(`<h1>${escapeHtml(text)}</h1>`);
    } else if (styleVal.match(/quote/i)) {
      htmlParts.push(`<blockquote>${escapeHtml(text)}</blockquote>`);
    } else {
      // Body paragraph: preserve per-run bold/italic as inline-styled spans so
      // parseHtmlContent can pick them up. Fall back to plain text if a
      // paragraph somehow has no runs.
      const inner = runsToHtml(para) || escapeHtml(text);
      htmlParts.push(`<p>${inner}</p>`);
    }
  }

  while (imageIndex < imageKeys.length) {
    const src = images.get(imageKeys[imageIndex]) || '';
    htmlParts.push(`<img src="${src}" width="800" height="600" />`);
    imageIndex++;
  }

  return htmlParts.join('\n');
}

// A run property like <w:b/> means "on"; <w:b w:val="false"/> (or "0") means
// "off". Anything else with the element present counts as on.
function isRunPropOn(rPr: Element | null, localName: string): boolean {
  if (!rPr) return false;
  const el = Array.from(rPr.children).find((c) => c.localName === localName);
  if (!el) return false;
  const val = el.getAttribute('w:val') ?? el.getAttribute('val');
  if (val === null) return true;
  return val !== 'false' && val !== '0';
}

// Convert a paragraph's runs (<w:r>) into inline HTML, wrapping bold/italic runs
// in styled spans. Word stores character formatting per run, not per paragraph.
function runsToHtml(para: Element): string {
  const runs = para.getElementsByTagNameNS('*', 'r');
  let html = '';
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const textEls = run.getElementsByTagNameNS('*', 't');
    let runText = '';
    for (let j = 0; j < textEls.length; j++) {
      runText += textEls[j].textContent || '';
    }
    if (!runText) continue;

    const rPr = Array.from(run.children).find((c) => c.localName === 'rPr') || null;
    let seg = escapeHtml(runText);
    if (isRunPropOn(rPr, 'b')) seg = `<span style="font-weight:700">${seg}</span>`;
    if (isRunPropOn(rPr, 'i')) seg = `<span style="font-style:italic">${seg}</span>`;
    html += seg;
  }
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// ---- Minimal ZIP reader (synchronous, no external deps) ----

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function readZipEntries(uint8: Uint8Array): ZipEntry[] {
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const entries: ZipEntry[] = [];

  // Find End of Central Directory record
  let eocdOffset = -1;
  for (let i = uint8.length - 22; i >= Math.max(0, uint8.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error('Not a valid ZIP file');

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const centralDirEntries = view.getUint16(eocdOffset + 10, true);

  let offset = centralDirOffset;

  for (let i = 0; i < centralDirEntries; i++) {
    if (offset + 46 > uint8.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const nameBytes = uint8.slice(offset + 46, offset + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    offset += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue;

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

    const rawData = uint8.slice(dataOffset, dataOffset + compressedSize);

    let fileData: Uint8Array;
    if (compressionMethod === 0) {
      fileData = rawData;
    } else if (compressionMethod === 8) {
      fileData = inflateRaw(rawData, uncompressedSize);
    } else {
      continue;
    }

    entries.push({ name, data: fileData });
  }

  return entries;
}

// ---- Minimal inflate (raw deflate decompression) ----

function inflateRaw(data: Uint8Array, expectedSize: number): Uint8Array {
  const output = new Uint8Array(expectedSize || data.length * 4);
  let opos = 0;
  let pos = 0;
  let bitBuf = 0;
  let bitCount = 0;

  function readBits(n: number): number {
    while (bitCount < n) {
      if (pos >= data.length) return -1;
      bitBuf |= data[pos++] << bitCount;
      bitCount += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>= n;
    bitCount -= n;
    return val;
  }

  function ensure(needed: number) {
    if (opos + needed <= output.length) return;
    // Should not happen with correct expectedSize, but handle gracefully
    throw new Error('Inflate output overflow');
  }

  // Fixed Huffman tables
  const fixedLitLen = buildFixedLitLenTree();
  const fixedDist = buildFixedDistTree();

  while (true) {
    const bfinal = readBits(1);
    const btype = readBits(2);

    if (btype === 0) {
      // Stored
      bitBuf = 0;
      bitCount = 0;
      const len = data[pos] | (data[pos + 1] << 8);
      pos += 4; // skip len and nlen
      ensure(len);
      output.set(data.slice(pos, pos + len), opos);
      opos += len;
      pos += len;
    } else if (btype === 1 || btype === 2) {
      let litLenTree: HuffTree;
      let distTree: HuffTree;

      if (btype === 1) {
        litLenTree = fixedLitLen;
        distTree = fixedDist;
      } else {
        const trees = decodeDynamicTrees();
        litLenTree = trees.litLen;
        distTree = trees.dist;
      }

      while (true) {
        const sym = decodeSymbol(litLenTree);
        if (sym < 256) {
          ensure(1);
          output[opos++] = sym;
        } else if (sym === 256) {
          break;
        } else {
          const lenIdx = sym - 257;
          const lenBase = LENGTH_BASE[lenIdx];
          const lenExtra = LENGTH_EXTRA[lenIdx];
          const length = lenBase + (lenExtra > 0 ? readBits(lenExtra) : 0);

          const distSym = decodeSymbol(distTree);
          const distBase = DIST_BASE[distSym];
          const distExtra = DIST_EXTRA[distSym];
          const dist = distBase + (distExtra > 0 ? readBits(distExtra) : 0);

          ensure(length);
          for (let i = 0; i < length; i++) {
            output[opos] = output[opos - dist];
            opos++;
          }
        }
      }
    } else {
      throw new Error('Invalid deflate block type');
    }

    if (bfinal) break;
  }

  function decodeDynamicTrees() {
    const hlit = readBits(5) + 257;
    const hdist = readBits(5) + 1;
    const hclen = readBits(4) + 4;

    const codeLenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    const codeLenLengths = new Uint8Array(19);
    for (let i = 0; i < hclen; i++) {
      codeLenLengths[codeLenOrder[i]] = readBits(3);
    }

    const codeLenTree = buildTree(codeLenLengths);
    const lengths = new Uint8Array(hlit + hdist);
    let i = 0;

    while (i < hlit + hdist) {
      const sym = decodeSymbol(codeLenTree);
      if (sym < 16) {
        lengths[i++] = sym;
      } else if (sym === 16) {
        const rep = readBits(2) + 3;
        const val = lengths[i - 1];
        for (let j = 0; j < rep; j++) lengths[i++] = val;
      } else if (sym === 17) {
        const rep = readBits(3) + 3;
        for (let j = 0; j < rep; j++) lengths[i++] = 0;
      } else {
        const rep = readBits(7) + 11;
        for (let j = 0; j < rep; j++) lengths[i++] = 0;
      }
    }

    return {
      litLen: buildTree(lengths.slice(0, hlit)),
      dist: buildTree(lengths.slice(hlit)),
    };
  }

  function decodeSymbol(tree: HuffTree): number {
    let node = tree;
    while (node.left !== undefined || node.right !== undefined) {
      const bit = readBits(1);
      if (bit === 0) {
        node = node.left!;
      } else {
        node = node.right!;
      }
    }
    return node.value!;
  }

  return output.slice(0, opos);
}

interface HuffTree {
  left?: HuffTree;
  right?: HuffTree;
  value?: number;
}

function buildTree(lengths: Uint8Array | number[]): HuffTree {
  const maxLen = Math.max(...Array.from(lengths));
  if (maxLen === 0) return { value: 0 };

  const blCount = new Uint16Array(maxLen + 1);
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0) blCount[lengths[i]]++;
  }

  const nextCode = new Uint16Array(maxLen + 1);
  let code = 0;
  for (let bits = 1; bits <= maxLen; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  const root: HuffTree = {};
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    if (len === 0) continue;

    const c = nextCode[len]++;
    let node = root;
    for (let bit = len - 1; bit >= 0; bit--) {
      const b = (c >> bit) & 1;
      if (b === 0) {
        if (!node.left) node.left = {};
        node = node.left;
      } else {
        if (!node.right) node.right = {};
        node = node.right;
      }
    }
    node.value = i;
  }

  return root;
}

function buildFixedLitLenTree(): HuffTree {
  const lengths = new Uint8Array(288);
  for (let i = 0; i <= 143; i++) lengths[i] = 8;
  for (let i = 144; i <= 255; i++) lengths[i] = 9;
  for (let i = 256; i <= 279; i++) lengths[i] = 7;
  for (let i = 280; i <= 287; i++) lengths[i] = 8;
  return buildTree(lengths);
}

function buildFixedDistTree(): HuffTree {
  const lengths = new Uint8Array(30);
  for (let i = 0; i < 30; i++) lengths[i] = 5;
  return buildTree(lengths);
}

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
  67, 83, 99, 115, 131, 163, 195, 227, 258,
];

const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
  5, 5, 5, 0,
];

const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513,
  769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];

const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
  11, 11, 12, 12, 13, 13,
];
