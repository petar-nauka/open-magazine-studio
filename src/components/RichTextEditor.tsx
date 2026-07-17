import { useRef, useEffect, useState, useCallback } from 'react';
import { Bold, Italic, Underline, Link as LinkIcon, Unlink } from 'lucide-react';
import {
  type ContentBlock,
  type RichSegment,
  richSegmentsToHtml,
  domToSegments,
} from '../lib/paste-parser';

interface RichTextEditorProps {
  block: ContentBlock;
  isActive: boolean;
  onActivate: () => void;
  onChange: (content: string, segments: RichSegment[] | undefined) => void;
}

// Inline rich-text editor for a single block. Renders the block's segments into
// a contentEditable field; selecting text pops a floating toolbar (bold/italic/
// underline/link) and Ctrl+B/I/U work too. Formatting is applied with the
// browser's execCommand, then the DOM is read back into segments — so an edit
// never destroys existing formatting (which the old plain <textarea> did).
export function RichTextEditor({ block, isActive, onActivate, onChange }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Seed the editable HTML once, when this block becomes active. We must NOT
  // re-set innerHTML on every keystroke — React does not own contentEditable's
  // children, so rewriting them would reset the caret to the start.
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const seed =
      block.metadata.richSegments ??
      (block.metadata.bold || block.metadata.italic
        ? [{ text: block.content, bold: block.metadata.bold, italic: block.metadata.italic }]
        : undefined);
    ref.current.innerHTML = richSegmentsToHtml(seed, block.content);
    ref.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, block.id]);

  const serialize = useCallback(() => {
    if (!ref.current) return;
    const { text, segments } = domToSegments(ref.current);
    onChange(text, segments);
  }, [onChange]);

  const updateToolbar = useCallback(() => {
    const sel = window.getSelection();
    const host = ref.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !host) {
      setToolbar(null);
      setLinkOpen(false);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!host.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    setToolbar({ top: rect.top - hostRect.top, left: rect.left - hostRect.left + rect.width / 2 });
  }, []);

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd, false, value);
    serialize();
    updateToolbar();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); exec('bold'); }
      else if (k === 'i') { e.preventDefault(); exec('italic'); }
      else if (k === 'u') { e.preventDefault(); exec('underline'); }
    }
  };

  const openLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    // Remember the selection: focusing the URL input drops it, and createLink
    // needs it back to know what to wrap.
    savedRange.current = sel.getRangeAt(0).cloneRange();
    let existing = '';
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (node && node !== ref.current) {
      if (node.nodeType === 1 && (node as Element).tagName === 'A') {
        existing = (node as HTMLAnchorElement).getAttribute('href') || '';
        break;
      }
      node = node.parentNode;
    }
    setLinkUrl(existing);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    if (url) {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('createLink', false, url);
    }
    serialize();
    setLinkOpen(false);
    updateToolbar();
  };

  if (!isActive) {
    return (
      <div
        onClick={onActivate}
        className="text-xs text-gray-700 line-clamp-3 cursor-text px-1 py-0.5 rounded hover:bg-gray-50 min-h-[20px]"
      >
        {block.content || <span className="text-gray-400 italic">Празен блок...</span>}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={serialize}
        onKeyDown={onKeyDown}
        onKeyUp={updateToolbar}
        onMouseUp={updateToolbar}
        onBlur={serialize}
        className="w-full text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[60px] leading-relaxed whitespace-pre-wrap"
      />

      {toolbar && (
        <div
          className="absolute z-30 flex items-center gap-0.5 bg-gray-900 text-white rounded-md shadow-lg px-1 py-0.5"
          style={{ top: toolbar.top, left: toolbar.left, transform: 'translate(-50%, calc(-100% - 6px))' }}
          // Keep the editor's selection alive when clicking the toolbar chrome.
          onMouseDown={(e) => e.preventDefault()}
        >
          {linkOpen ? (
            <div className="flex items-center gap-1 px-1">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyLink();
                  if (e.key === 'Escape') setLinkOpen(false);
                }}
                placeholder="https://..."
                className="text-[11px] bg-gray-800 rounded px-1.5 py-0.5 w-40 focus:outline-none placeholder:text-gray-500"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyLink}
                className="px-1.5 py-0.5 text-[11px] rounded hover:bg-gray-700"
              >
                OK
              </button>
            </div>
          ) : (
            <>
              <ToolbarBtn title="Получер (Ctrl+B)" onClick={() => exec('bold')}>
                <Bold className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Курсив (Ctrl+I)" onClick={() => exec('italic')}>
                <Italic className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Подчертан (Ctrl+U)" onClick={() => exec('underline')}>
                <Underline className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <span className="w-px h-4 bg-gray-700 mx-0.5" />
              <ToolbarBtn title="Добави линк" onClick={openLink}>
                <LinkIcon className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <ToolbarBtn title="Махни линк" onClick={() => exec('unlink')}>
                <Unlink className="w-3.5 h-3.5" />
              </ToolbarBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1 rounded hover:bg-gray-700 transition-colors"
    >
      {children}
    </button>
  );
}
