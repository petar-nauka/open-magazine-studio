import { type ContentBlock } from '../lib/paste-parser';
import { Image, Type, Heading, Quote } from 'lucide-react';

interface BlockListProps {
  blocks: ContentBlock[];
  onBlockClick?: (block: ContentBlock) => void;
}

export function BlockList({ blocks, onBlockClick }: BlockListProps) {
  const getIcon = (type: ContentBlock['type']) => {
    switch (type) {
      case 'heading':
        return <Heading className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'pull_quote':
        return <Quote className="w-4 h-4" />;
      default:
        return <Type className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: ContentBlock['type']) => {
    switch (type) {
      case 'heading':
        return 'Заглавие';
      case 'image':
        return 'Снимка';
      case 'pull_quote':
        return 'Цитат';
      default:
        return 'Текст';
    }
  };

  return (
    <div className="space-y-1.5">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-200"
          onClick={() => onBlockClick?.(block)}
        >
          <div
            className={`
              mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0
              ${block.type === 'heading' ? 'bg-amber-100 text-amber-700' : ''}
              ${block.type === 'text' ? 'bg-gray-100 text-gray-600' : ''}
              ${block.type === 'image' ? 'bg-blue-100 text-blue-700' : ''}
              ${block.type === 'pull_quote' ? 'bg-emerald-100 text-emerald-700' : ''}
            `}
          >
            {getIcon(block.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
              {getTypeLabel(block.type)}
              {block.type === 'heading' && block.metadata.level && ` H${block.metadata.level}`}
              {block.type === 'image' && block.metadata.imageAspect && ` (${block.metadata.imageAspect})`}
            </div>

            {block.type === 'image' ? (
              <div className="w-full h-16 rounded bg-gray-100 overflow-hidden">
                <img
                  src={block.content}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-700 line-clamp-2">{block.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
