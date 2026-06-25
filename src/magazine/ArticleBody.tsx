import type { ReactNode } from 'react';
import type { DocBlock } from '../lib/document-model';
import { effectiveSpan, type RichSegment } from '../lib/paste-parser';
import type { Align } from '../design-system/alignment';

// Render bold/italic segments as inline markup. Falls back to plain text when
// the block carries no formatting.
function renderInline(segments: RichSegment[] | undefined, fallback: ReactNode): ReactNode {
  if (!segments || segments.length === 0) return fallback;
  return segments.map((seg, i) => {
    let node: ReactNode = seg.text;
    if (seg.bold) node = <strong>{node}</strong>;
    if (seg.italic) node = <em>{node}</em>;
    return <span key={i}>{node}</span>;
  });
}

// Drop the leading character from rich segments (paired with a drop-cap).
function withoutFirstChar(segments: RichSegment[]): RichSegment[] {
  const result = [...segments];
  for (let i = 0; i < result.length; i++) {
    if (result[i].text.length > 0) {
      result[i] = { ...result[i], text: result[i].text.slice(1) };
      break;
    }
  }
  return result;
}

function Bullet({ content, align }: { content: string; align?: Align }) {
  const text = content.replace(/^•\s*/, '');
  const idx = text.indexOf(':');
  const style = align ? { textAlign: align } : undefined;
  if (idx > 0 && idx < 40) {
    return (
      <p className="bullet" style={style}>
        <strong>{text.slice(0, idx + 1)}</strong>
        {text.slice(idx + 1)}
      </p>
    );
  }
  return <p className="bullet" style={style}>{text}</p>;
}

export function ArticleBody({ blocks, align, dropCap }: { blocks: DocBlock[]; align: Align; dropCap: boolean }) {
  let leadUsed = false;
  return (
    <div className="article-body" style={{ textAlign: align }}>
      {blocks.map((b) => {
        const a = b.metadata.align;
        switch (b.role) {
          case 'subheading':
            return <h2 className="subheading" key={b.id} style={a ? { textAlign: a } : undefined}>{b.content}</h2>;
          case 'bullet':
            return <Bullet key={b.id} content={b.content} align={a} />;
          case 'pull_quote':
            return <p className="pull-quote" key={b.id} style={a ? { textAlign: a } : undefined}>{b.content}</p>;
          case 'image':
            return <img className={effectiveSpan(b) === 'full' ? 'full' : 'inline'} key={b.id} src={b.content} alt="" />;
          case 'ad': {
            // Advert size: 'page' (own sheet), 'column' (within one column) or
            // 'full' (banner spanning both columns — the default; also where
            // legacy values land). An optional href makes the whole advert a
            // clickable link that stays active in the printed PDF. Positioning
            // classes live on the outer element (the <a> when linked), since it
            // is the direct child of the column flow.
            const mode = b.metadata.adMode;
            const page = mode === 'page';
            const cls = page
              ? 'ad-inline-page'
              : mode === 'column' ? 'ad-banner-wrap ad-col' : 'ad-banner-wrap ad-full';
            const style = page ? { backgroundImage: `url("${b.content}")` } : undefined;
            const inner = page ? null : <img src={b.content} alt="Реклама" />;
            const href = b.metadata.href?.trim();
            return href
              ? <a className={cls} key={b.id} href={href} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a>
              : <div className={cls} key={b.id} style={style}>{inner}</div>;
          }
          case 'references':
            return <p className="references" key={b.id} style={a ? { textAlign: a } : undefined} dangerouslySetInnerHTML={{ __html: linkify(b.content) }} />;
          case 'body':
          default: {
            const isLead = !leadUsed;
            if (isLead) leadUsed = true;
            const useDropCap = isLead && dropCap && !!b.content;
            const segs = b.metadata.richSegments;
            return (
              <p className={useDropCap ? 'lead' : undefined} key={b.id} style={a ? { textAlign: a } : undefined}>
                {useDropCap
                  ? (<><span className="dropcap">{b.content.slice(0, 1)}</span>{renderInline(segs ? withoutFirstChar(segs) : undefined, b.content.slice(1))}</>)
                  : renderInline(segs, b.content)}
              </p>
            );
          }
        }
      })}
    </div>
  );
}

function linkify(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
}
