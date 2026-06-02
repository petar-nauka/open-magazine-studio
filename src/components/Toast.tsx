import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface Props { message: string; onClose: () => void; actionLabel?: string; onAction?: () => void; }

export function Toast({ message, onClose, actionLabel, onAction }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg">
      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      <span className="text-sm">{message}</span>
      {actionLabel && onAction && (
        <button onClick={onAction} className="text-sm font-medium text-emerald-300 hover:text-emerald-200 underline">{actionLabel}</button>
      )}
      <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  );
}
