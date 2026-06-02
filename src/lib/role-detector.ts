import type { ContentBlock } from './paste-parser';

export type BlockRole =
  | 'title'
  | 'subheading'
  | 'body'
  | 'bullet'
  | 'pull_quote'
  | 'references'
  | 'image';

const SOURCES_RE = /^(използвани\s+източници|източници|литература|references)\s*:?\s*$/i;

function isSourcesHeading(b: ContentBlock): boolean {
  return b.type === 'heading' && SOURCES_RE.test(b.content.trim());
}

export function detectRole(block: ContentBlock, all: ContentBlock[], index: number): BlockRole {
  // Anything at/after a "sources" heading (but not the heading itself) is references.
  for (let i = 0; i < index; i++) {
    if (isSourcesHeading(all[i])) {
      if (block.type === 'image') return 'image';
      return 'references';
    }
  }

  if (block.type === 'image') return 'image';
  if (block.type === 'pull_quote') return 'pull_quote';

  if (block.type === 'heading') {
    const isFirstHeading = all.slice(0, index).every((b) => b.type !== 'heading');
    if ((block.metadata.level ?? 2) === 1 && isFirstHeading) return 'title';
    return 'subheading';
  }

  // text block
  if (block.content.trimStart().startsWith('•')) return 'bullet';
  return 'body';
}
