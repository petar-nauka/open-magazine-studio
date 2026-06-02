import type { PageConfig, BrandingConfig } from '../lib/layout-engine';
import type { ContentBlock } from '../lib/paste-parser';

interface MagazinePreviewProps {
  pages: PageConfig[];
  accentColor: string;
  articleTitle: string;
  articleAuthor?: string;
  branding: BrandingConfig;
}

export function MagazinePreview({
  pages,
  accentColor,
  articleTitle,
  articleAuthor,
  branding,
}: MagazinePreviewProps) {
  return (
    <div className="space-y-8">
      {pages.map((page, pageIdx) => (
        <div
          key={page.id}
          className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
          style={{ aspectRatio: '210 / 297' }}
        >
          <div className="h-full flex flex-col px-8 py-5">
            {/* Header */}
            <PageHeader
              branding={branding}
              accentColor={accentColor}
              isFirstPage={pageIdx === 0}
            />

            {/* Article title on first page */}
            {pageIdx === 0 && (
              <div className="mb-3">
                <h1 className="text-xl font-bold text-gray-900 leading-tight font-serif">
                  {articleTitle}
                </h1>
                {articleAuthor && (
                  <p className="text-[10px] text-gray-500 mt-1 italic">by {articleAuthor}</p>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {page.layout === 'hero-top' && (
                <HeroLayout blocks={page.blocks} accentColor={accentColor} />
              )}
              {page.layout === 'two-column' && (
                <TwoColumnLayout
                  blocks={page.blocks}
                  pullQuote={page.pullQuote}
                  accentColor={accentColor}
                />
              )}
              {page.layout === 'full-width' && (
                <FullWidthLayout blocks={page.blocks} accentColor={accentColor} />
              )}
              {page.layout === 'sidebar-image' && (
                <SidebarImageLayout blocks={page.blocks} accentColor={accentColor} />
              )}
              {page.layout === 'text-dense' && (
                <TextDenseLayout
                  blocks={page.blocks}
                  pullQuote={page.pullQuote}
                  accentColor={accentColor}
                />
              )}
            </div>

            {/* Footer */}
            <PageFooter
              branding={branding}
              accentColor={accentColor}
              pageNumber={pageIdx + 1}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageHeader({
  branding,
  accentColor,
  isFirstPage,
}: {
  branding: BrandingConfig;
  accentColor: string;
  isFirstPage: boolean;
}) {
  const hasContent = branding.headerText || branding.logoUrl;
  if (!hasContent && !isFirstPage) return null;

  return (
    <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: `${accentColor}30` }}>
      <div className="flex items-center gap-2">
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt=""
            className="h-4 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {branding.headerText && (
          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">
            {branding.headerText}
          </span>
        )}
      </div>
      {isFirstPage && !hasContent && (
        <div className="w-8 h-0.5 rounded" style={{ backgroundColor: accentColor }} />
      )}
    </div>
  );
}

function PageFooter({
  branding,
  accentColor,
  pageNumber,
}: {
  branding: BrandingConfig;
  accentColor: string;
  pageNumber: number;
}) {
  return (
    <div
      className="flex items-center justify-between pt-2 mt-auto border-t"
      style={{ borderColor: `${accentColor}20` }}
    >
      <span className="text-[8px] text-gray-400">
        {branding.footerText}
      </span>
      <span className="text-[8px] text-gray-400">{pageNumber}</span>
      {branding.footerLink && branding.footerLinkLabel && (
        <span className="text-[8px]" style={{ color: accentColor }}>
          {branding.footerLinkLabel}
        </span>
      )}
    </div>
  );
}

function ArticleImage({ block, className }: { block: ContentBlock; className?: string }) {
  return (
    <div className={`rounded overflow-hidden bg-gray-100 ${className || ''}`}>
      <img
        src={block.content}
        alt=""
        className="w-full h-full object-contain"
        onError={(e) => {
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            parent.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
            (e.target as HTMLImageElement).style.display = 'none';
          }
        }}
      />
    </div>
  );
}

function TextBlock({ block, accentColor, isFirst }: { block: ContentBlock; accentColor: string; isFirst?: boolean }) {
  if (block.type === 'heading') {
    const size = block.metadata.level === 1 ? 'text-sm' : 'text-xs';
    return (
      <p className={`${size} font-bold text-gray-900 mb-2 mt-3 first:mt-0`}>
        {block.content}
      </p>
    );
  }

  if (block.type === 'pull_quote') {
    return (
      <blockquote
        className="text-[10px] italic text-gray-600 pl-2 border-l-2 my-2"
        style={{ borderColor: accentColor }}
      >
        {block.content}
      </blockquote>
    );
  }

  return (
    <p className="text-[10px] leading-[1.6] text-gray-700 mb-2 break-inside-avoid">
      {isFirst && (
        <span className="text-base font-bold float-left mr-1 leading-none mt-0.5" style={{ color: accentColor }}>
          {block.content[0]}
        </span>
      )}
      {isFirst ? block.content.slice(1) : block.content}
    </p>
  );
}

function HeroLayout({ blocks, accentColor }: { blocks: ContentBlock[]; accentColor: string }) {
  const imageBlock = blocks.find((b) => b.type === 'image');
  const textBlocks = blocks.filter((b) => b.type === 'text' || b.type === 'heading');
  const firstText = textBlocks.findIndex((b) => b.type === 'text');

  return (
    <div className="flex flex-col gap-3 h-full">
      {imageBlock && <ArticleImage block={imageBlock} className="w-full max-h-[35%] shrink-0" />}
      <div className="columns-2 gap-5 flex-1 overflow-hidden">
        {textBlocks.map((block, i) => (
          <TextBlock
            key={block.id}
            block={block}
            accentColor={accentColor}
            isFirst={i === firstText}
          />
        ))}
      </div>
    </div>
  );
}

function TwoColumnLayout({
  blocks,
  pullQuote,
  accentColor,
}: {
  blocks: ContentBlock[];
  pullQuote?: string;
  accentColor: string;
}) {
  const textBlocks = blocks.filter((b) => b.type !== 'image');
  const imageBlocks = blocks.filter((b) => b.type === 'image');

  return (
    <div className="flex flex-col gap-3 h-full">
      {imageBlocks.length > 0 && (
        <div className="flex gap-2 shrink-0" style={{ maxHeight: '25%' }}>
          {imageBlocks.map((img) => (
            <ArticleImage key={img.id} block={img} className="flex-1 h-full" />
          ))}
        </div>
      )}

      {pullQuote && (
        <blockquote
          className="border-l-3 pl-3 py-1 text-[10px] italic text-gray-600 font-serif shrink-0"
          style={{ borderLeftWidth: '3px', borderColor: accentColor }}
        >
          "{pullQuote.slice(0, 140)}"
        </blockquote>
      )}

      <div className="columns-2 gap-5 flex-1 overflow-hidden">
        {textBlocks.map((block) => (
          <TextBlock key={block.id} block={block} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}

function FullWidthLayout({ blocks, accentColor }: { blocks: ContentBlock[]; accentColor: string }) {
  const imageBlock = blocks.find((b) => b.type === 'image');
  const textBlocks = blocks.filter((b) => b.type !== 'image');

  return (
    <div className="flex flex-col gap-3 h-full">
      {imageBlock && <ArticleImage block={imageBlock} className="w-full max-h-[30%] shrink-0" />}
      <div className="columns-2 gap-5 flex-1 overflow-hidden">
        {textBlocks.map((block) => (
          <TextBlock key={block.id} block={block} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}

function SidebarImageLayout({ blocks, accentColor }: { blocks: ContentBlock[]; accentColor: string }) {
  const imageBlock = blocks.find((b) => b.type === 'image');
  const textBlocks = blocks.filter((b) => b.type !== 'image');

  return (
    <div className="flex gap-4 h-full">
      {imageBlock && (
        <div className="w-[30%] shrink-0">
          <ArticleImage block={imageBlock} className="w-full h-full max-h-[60%]" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {textBlocks.map((block) => (
          <TextBlock key={block.id} block={block} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}

function TextDenseLayout({
  blocks,
  pullQuote,
  accentColor,
}: {
  blocks: ContentBlock[];
  pullQuote?: string;
  accentColor: string;
}) {
  const textBlocks = blocks.filter((b) => b.type !== 'image');

  return (
    <div className="flex flex-col gap-3 h-full">
      {pullQuote && (
        <blockquote
          className="pl-3 py-1 text-[10px] italic text-gray-600 font-serif shrink-0 border-l-2"
          style={{ borderColor: accentColor }}
        >
          "{pullQuote.slice(0, 140)}"
        </blockquote>
      )}
      <div className="columns-2 gap-5 flex-1 overflow-hidden">
        {textBlocks.map((block) => (
          <TextBlock key={block.id} block={block} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}
