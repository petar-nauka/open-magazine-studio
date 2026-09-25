import { reconcileRichSegments, type ContentBlock, type ParsedArticle } from './paste-parser';
import { detectRole, type BlockRole } from './role-detector';
import type { AccentName } from '../design-system/brand';
import type { Align } from '../design-system/alignment';

export interface DocBlock extends ContentBlock {
  role: BlockRole;
}

export interface ArticleDoc {
  title: string;
  author: string;
  accent: AccentName | string;
  align: Align;
  openerImage?: string;
  dropCap: boolean;
  blocks: DocBlock[];
}

// The article title lives in its first level-1 heading (the block that gets the
// 'title' role). This is the single source of truth: the opener and any saved
// title read it, so editing that heading updates the cover — no second copy to
// drift out of sync.
export function findTitleBlock(blocks: ContentBlock[]): ContentBlock | undefined {
  const firstHeading = blocks.find((b) => b.type === 'heading');
  return firstHeading && (firstHeading.metadata.level ?? 2) === 1 ? firstHeading : undefined;
}

// Writes a new title back into the H1 block — the single source of truth the
// cover reads (see findTitleBlock). Returns the same array untouched when there
// is no H1, so callers can tell that nothing was written and fall back to their
// standalone title field. richSegments are reconciled, otherwise the block's
// stale inline runs would keep rendering the OLD words in the block editor.
export function withTitle<T extends ContentBlock>(blocks: T[], title: string): T[] {
  const titleBlock = findTitleBlock(blocks);
  if (!titleBlock) return blocks;
  return blocks.map((b) =>
    b.id === titleBlock.id
      ? { ...b, content: title, metadata: reconcileRichSegments(title, b.metadata) }
      : b
  );
}

export function articleFromParsed(
  parsed: ParsedArticle,
  opts: { author?: string; accent?: AccentName | string; align?: Align; dropCap?: boolean; openerImage?: string } = {}
): ArticleDoc {
  const blocks: DocBlock[] = parsed.blocks.map((b, i) => ({
    ...b,
    role: detectRole(b, parsed.blocks, i),
  }));

  const firstImage = blocks.find((b) => b.type === 'image');
  const titleBlock = findTitleBlock(parsed.blocks);

  // Opener image: 'none' = explicitly no cover image (every photo stays in the
  // body); a URL = that image; undefined = auto (first image becomes the cover
  // and is dropped from the body so it isn't shown twice).
  const openerImage = opts.openerImage === 'none'
    ? undefined
    : (opts.openerImage ?? firstImage?.content);

  return {
    title: titleBlock?.content.trim() || parsed.title,
    author: opts.author ?? '',
    accent: opts.accent ?? 'teal',
    align: opts.align ?? 'left',
    openerImage,
    dropCap: opts.dropCap ?? true,
    blocks,
  };
}
