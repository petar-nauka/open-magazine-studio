import type { CSSProperties } from 'react';
import { ArticleOpener } from './ArticleOpener';
import { ArticleBody } from './ArticleBody';
import { resolveAccent } from '../design-system/brand';
import type { ArticleDoc } from '../lib/document-model';

export function MagazineDocument({ doc, anchorId }: { doc: ArticleDoc; anchorId?: string }) {
  const accent = resolveAccent(doc.accent);
  // Title is rendered on the opener; the opener image is full-bleed — exclude both from the body flow.
  const bodyBlocks = doc.blocks.filter(
    (b) => b.role !== 'title' && !(b.role === 'image' && b.content === doc.openerImage)
  );
  const style = { '--accent': accent } as CSSProperties;
  return (
    <div className="magazine" style={style}>
      <ArticleOpener title={doc.title} author={doc.author} image={doc.openerImage} anchorId={anchorId} />
      <ArticleBody blocks={bodyBlocks} align={doc.align} dropCap={doc.dropCap} />
    </div>
  );
}
