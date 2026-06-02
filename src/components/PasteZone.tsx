import { useState, useCallback, useRef, useEffect } from 'react';
import { ClipboardPaste, FileText, Upload, FileUp, Loader2 } from 'lucide-react';
import { parseHtmlContent, parsePlainText, type ParsedArticle } from '../lib/paste-parser';
import { parseDocxFile } from '../lib/docx-parser';

interface PasteZoneProps {
  onArticleParsed: (article: ParsedArticle) => void;
}

export function PasteZone({ onArticleParsed }: PasteZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      setStatus('processing');
      setErrorMsg('');

      const html = e.clipboardData.getData('text/html');
      const plainText = e.clipboardData.getData('text/plain');

      try {
        let article: ParsedArticle;

        if (html && html.trim().length > 20) {
          article = parseHtmlContent(html);
        } else if (plainText && plainText.trim().length > 0) {
          article = parsePlainText(plainText);
        } else {
          setStatus('error');
          setErrorMsg('Clipboard-ът е празен. Опитай отново с Ctrl+V.');
          return;
        }

        if (article.blocks.length === 0) {
          setStatus('error');
          setErrorMsg('Не бяха открити текстови блокове в съдържанието.');
          return;
        }

        setStatus('success');
        setTimeout(() => onArticleParsed(article), 300);
      } catch {
        setStatus('error');
        setErrorMsg('Грешка при обработка на съдържанието.');
      }
    },
    [onArticleParsed]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setStatus('processing');
      setErrorMsg('');

      try {
        if (!file.name.endsWith('.docx')) {
          setStatus('error');
          setErrorMsg('Поддържат се само .docx файлове. Свали документа от Google Docs като .docx.');
          return;
        }

        const article = await parseDocxFile(file);

        if (article.blocks.length === 0) {
          setStatus('error');
          setErrorMsg('Файлът е празен или не съдържа разпознаваемо съдържание.');
          return;
        }

        setStatus('success');
        setTimeout(() => onArticleParsed(article), 300);
      } catch (err) {
        setStatus('error');
        const msg = err instanceof Error ? err.message : 'Неизвестна грешка';
        setErrorMsg(`Грешка при четене на .docx файла: ${msg}`);
      }
    },
    [onArticleParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
        return;
      }

      const html = e.dataTransfer.getData('text/html');
      const plainText = e.dataTransfer.getData('text/plain');

      try {
        let article: ParsedArticle;
        if (html && html.trim().length > 20) {
          article = parseHtmlContent(html);
        } else if (plainText) {
          article = parsePlainText(plainText);
        } else {
          return;
        }

        if (article.blocks.length > 0) {
          setStatus('success');
          setTimeout(() => onArticleParsed(article), 300);
        }
      } catch {
        setStatus('error');
        setErrorMsg('Грешка при обработка.');
      }
    },
    [onArticleParsed, handleFileUpload]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="space-y-4">
      {/* Main paste area */}
      <div
        ref={containerRef}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center
          transition-all duration-300 min-h-[220px]
          flex items-center justify-center cursor-text
          ${isDragOver ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]' : ''}
          ${status === 'idle' ? 'border-gray-300 hover:border-gray-400 bg-white' : ''}
          ${status === 'processing' ? 'border-amber-400 bg-amber-50/30' : ''}
          ${status === 'success' ? 'border-emerald-500 bg-emerald-50/30' : ''}
          ${status === 'error' ? 'border-red-400 bg-red-50/30' : ''}
        `}
        onClick={() => textareaRef.current?.focus()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
      >
        {/* Hidden textarea to capture paste events reliably */}
        <textarea
          ref={textareaRef}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onPaste={handlePaste}
          aria-label="Paste content here"
          tabIndex={0}
        />

        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            {status === 'processing' ? (
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            ) : status === 'success' ? (
              <FileText className="w-8 h-8 text-emerald-600" />
            ) : (
              <ClipboardPaste className="w-8 h-8 text-gray-400" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {status === 'processing' && 'Обработване...'}
              {status === 'success' && 'Статията е заредена!'}
              {status === 'error' && 'Нещо се обърка'}
              {status === 'idle' && 'Постави тук (Ctrl+V)'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {status === 'error' && errorMsg}
              {status === 'success' && 'Текстът и снимките бяха разпознати.'}
              {status === 'idle' &&
                'Кликни тук и натисни Ctrl+V за да поставиш съдържание от Google Docs. Снимките и форматирането ще бъдат запазени.'}
              {status === 'processing' && 'Извличане на текст, снимки и структура...'}
            </p>
          </div>

          <div className="flex items-center gap-6 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <ClipboardPaste className="w-3.5 h-3.5" />
              Ctrl+V
            </span>
            <span className="flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Drag & Drop
            </span>
          </div>
        </div>
      </div>

      {/* File upload button */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-px w-16 bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-wider">или</span>
          <div className="h-px w-16 bg-gray-200" />
        </div>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full border border-gray-200 rounded-xl p-4 flex items-center justify-center gap-3 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
      >
        <FileUp className="w-5 h-5 text-gray-400" />
        <span>
          Качи <strong>.docx</strong> файл (свален от Google Docs)
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {status === 'error' && (
        <button
          onClick={() => {
            setStatus('idle');
            setErrorMsg('');
            textareaRef.current?.focus();
          }}
          className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          Опитай отново
        </button>
      )}
    </div>
  );
}
