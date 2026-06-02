import type { DocBlock } from '../lib/document-model';
import type { Align } from '../design-system/alignment';

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
            return <img className="inline" key={b.id} src={b.content} alt="" />;
          case 'references':
            return <p className="references" key={b.id} style={a ? { textAlign: a } : undefined} dangerouslySetInnerHTML={{ __html: linkify(b.content) }} />;
          case 'body':
          default: {
            const isLead = !leadUsed;
            if (isLead) leadUsed = true;
            const useDropCap = isLead && dropCap && !!b.content;
            return (
              <p className={useDropCap ? 'lead' : undefined} key={b.id} style={a ? { textAlign: a } : undefined}>
                {useDropCap
                  ? (<><span className="dropcap">{b.content.slice(0, 1)}</span>{b.content.slice(1)}</>)
                  : b.content}
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
