import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare, X, Sparkles } from 'lucide-react';
import { type ContentBlock } from '../lib/paste-parser';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIChatPanelProps {
  blocks: ContentBlock[];
  articleTitle: string;
  onBlocksChange: (blocks: ContentBlock[]) => void;
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({ blocks, articleTitle, onBlocksChange, open, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const buildArticleContext = () => {
    const parts: string[] = [];
    parts.push(`Article title: "${articleTitle}"`);
    parts.push(`Total blocks: ${blocks.length}`);
    parts.push('');
    parts.push('--- ARTICLE CONTENT ---');

    blocks.forEach((block, idx) => {
      if (block.type === 'heading') {
        parts.push(`[Block ${idx} - HEADING H${block.metadata.level || 2}]: ${block.content}`);
      } else if (block.type === 'image') {
        parts.push(`[Block ${idx} - IMAGE]: ${block.content}`);
      } else if (block.type === 'pull_quote') {
        parts.push(`[Block ${idx} - QUOTE]: ${block.content}`);
      } else {
        parts.push(`[Block ${idx} - TEXT]: ${block.content}`);
      }
    });

    parts.push('--- END ARTICLE ---');
    return parts.join('\n');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const articleContext = buildArticleContext();

      const chatHistory = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...chatHistory, { role: 'user', content: text }],
          articleContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      const assistantContent = data.content || 'Грешка при генериране на отговор.';

      // Parse block rewrites from response
      const rewritePattern = /\[BLOCK (\d+) REWRITE\]:\s*([\s\S]*?)(?=\[BLOCK \d+ REWRITE\]|$)/g;
      let match;
      const rewrites: { idx: number; content: string }[] = [];

      while ((match = rewritePattern.exec(assistantContent)) !== null) {
        rewrites.push({ idx: parseInt(match[1]), content: match[2].trim() });
      }

      if (rewrites.length > 0) {
        const updated = [...blocks];
        for (const rw of rewrites) {
          if (rw.idx >= 0 && rw.idx < updated.length) {
            updated[rw.idx] = { ...updated[rw.idx], content: rw.content };
          }
        }
        onBlocksChange(updated);
      }

      setMessages((prev) => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Грешка: ${err instanceof Error ? err.message : 'Неизвестна грешка'}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[420px] h-[520px] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI Редактор</h3>
            <p className="text-[10px] text-gray-500">Вижда {blocks.length} блока от статията</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-xs text-gray-400 max-w-[260px] mx-auto leading-relaxed">
              Попитай AI-то нещо за статията - може да пренапише текст, да предложи заглавия, да обясни промени.
              Вижда цялото съдържание и снимките.
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                'Направи въведението по-кратко и ударно',
                'Предложи по-добро заглавие',
                'Промени тона на по-неформален',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`
                max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-800'}
              `}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
              <span className="text-xs text-gray-500">Мисли...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Напиши инструкция за статията..."
            rows={1}
            className="flex-1 resize-none text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 max-h-[80px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
