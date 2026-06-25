import type { ContentBlock, ParsedArticle } from './paste-parser';
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

  return {
    title: titleBlock?.content.trim() || parsed.title,
    author: opts.author ?? '',
    accent: opts.accent ?? 'teal',
    align: opts.align ?? 'justify',
    openerImage: opts.openerImage ?? firstImage?.content,
    dropCap: opts.dropCap ?? true,
    blocks,
  };
}
