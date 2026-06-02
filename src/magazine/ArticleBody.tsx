import type { DocBlock } from '../lib/document-model';

function Bullet({ content }: { content: string }) {
  const text = content.replace(/^•\s*/, '');
  const idx = text.indexOf(':');
  if (idx > 0 && idx < 40) {
    return (
      <p className="bullet">
        <strong>{text.slice(0, idx + 1)}</strong>
        {text.slice(idx + 1)}
      </p>
    );
  }
  return <p className="bullet">{text}</p>;
}

export function ArticleBody({ blocks }: { blocks: DocBlock[] }) {
  let leadUsed = false;
  return (
    <div className="article-body">
      {blocks.map((b) => {
        switch (b.role) {
          case 'subheading':
            return <h2 className="subheading" key={b.id}>{b.content}</h2>;
          case 'bullet':
            return <Bullet key={b.id} content={b.content} />;
          case 'pull_quote':
            return <p className="pull-quote" key={b.id}>{b.content}</p>;
          case 'image':
            return <img className="inline" key={b.id} src={b.content} alt="" />;
          case 'references':
            return <p className="references" key={b.id} dangerouslySetInnerHTML={{ __html: linkify(b.content) }} />;
          case 'body':
          default: {
            const isLead = !leadUsed;
            if (isLead) leadUsed = true;
            return <p className={isLead ? 'lead' : undefined} key={b.id}>{b.content}</p>;
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
