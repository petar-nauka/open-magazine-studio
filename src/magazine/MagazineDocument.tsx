import type { CSSProperties } from 'react';
import { ArticleOpener } from './ArticleOpener';
import { ArticleBody } from './ArticleBody';
import { resolveAccent } from '../design-system/brand';
import type { ArticleDoc } from '../lib/document-model';

export function MagazineDocument({ doc, anchorId }: { doc: ArticleDoc; anchorId?: string }) {
  const accent = resolveAccent(doc.accent);
  // The title is rendered on the opener, so it is the only block we drop. Images
  // stay in the body exactly as authored — the opener image is a separate
  // full-bleed background and is NOT subtracted from the flow. (We used to remove
  // any body image matching the cover, which silently hid photos the author had
  // placed in the text; the author controls placement, not the layout engine.)
  const bodyBlocks = doc.blocks.filter((b) => b.role !== 'title');
  const style = { '--accent': accent } as CSSProperties;
  return (
    <div className="magazine" style={style}>
      <ArticleOpener title={doc.title} author={doc.author} image={doc.openerImage} anchorId={anchorId} />
      <ArticleBody blocks={bodyBlocks} align={doc.align} dropCap={doc.dropCap} />
    </div>
  );
}
