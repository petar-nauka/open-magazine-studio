interface Props { title: string; author?: string; image?: string; anchorId?: string; }

export function ArticleOpener({ title, author, image, anchorId }: Props) {
  return (
    <section id={anchorId} className="opener" style={image ? { backgroundImage: `url(${image})` } : undefined}>
      <div className="scrim" />
      <div className="opener-title">{title}</div>
      {author && <div className="opener-author">{author}</div>}
    </section>
  );
}
