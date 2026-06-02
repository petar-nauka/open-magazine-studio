import type { ContentBlock, ParsedArticle } from './paste-parser';
import { detectRole, type BlockRole } from './role-detector';
import type { AccentName } from '../design-system/brand';

export interface DocBlock extends ContentBlock {
  role: BlockRole;
}

export interface ArticleDoc {
  title: string;
  author: string;
  accent: AccentName | string;
  openerImage?: string;
  blocks: DocBlock[];
}

export function articleFromParsed(
  parsed: ParsedArticle,
  opts: { author?: string; accent?: AccentName | string } = {}
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
    openerImage: firstImage?.content,
    blocks,
  };
}
