import type { RenderItem } from './load-issue-doc';

export interface TocEntry { anchorId: string; title: string; thumbnail?: string; }

// One TOC entry per article (inserts are skipped); order preserved.
export function buildTocEntries(items: RenderItem[]): TocEntry[] {
  return items
    .filter((it): it is Extract<RenderItem, { kind: 'article' }> => it.kind === 'article')
    .map((it) => ({ anchorId: `art-${it.id}`, title: it.doc.title, thumbnail: it.doc.openerImage }));
}
