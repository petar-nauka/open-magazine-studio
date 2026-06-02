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
  blocks: DocBlock[];
}

export function articleFromParsed(
  parsed: ParsedArticle,
  opts: { author?: string; accent?: AccentName | string; align?: Align } = {}
): ArticleDoc {
  const blocks: DocBlock[] = parsed.blocks.map((b, i) => ({
    ...b,
    role: detectRole(b, parsed.blocks, i),
  }));

  const firstImage = blocks.find((b) => b.type === 'image');

  return {
    title: parsed.title,
    author: opts.author ?? '',
    accent: opts.accent ?? 'teal',
    align: opts.align ?? 'justify',
    openerImage: firstImage?.content,
    blocks,
  };
}
