import type { TocEntry } from '../lib/toc';

// The „Съдържание" page. Page numbers are filled by CSS target-counter on each
// .toc-entry (the <a> carries the href that target-counter resolves to a page).
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  return (
    <div className="toc">
      <h1>Съдържание</h1>
      {entries.map((e) => (
        <a key={e.anchorId} className="toc-entry" href={`#${e.anchorId}`}>
          {e.thumbnail ? <img className="thumb" src={e.thumbnail} alt="" /> : <span className="thumb" />}
          <span className="title">{e.title}</span>
          <span className="leader" />
        </a>
      ))}
    </div>
  );
}
