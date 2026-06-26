import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { putDraft } from '../lib/render-handoff';
import type { ArticleDoc } from '../lib/document-model';

export interface MagazinePreviewFrameHandle {
  print: () => void;
}

interface Props { doc: ArticleDoc; debounceMs?: number; }

export const MagazinePreviewFrame = forwardRef<MagazinePreviewFrameHandle, Props>(
  function MagazinePreviewFrame({ doc, debounceMs = 700 }, ref) {
    const frameRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
      print: () => {
        const win = frameRef.current?.contentWindow;
        if (!win) return;
        // Wait for the iframe's fonts to finish loading before printing, so the
        // text isn't rasterised blank/fallback (font-display) on a slow layout.
        const fonts = win.document?.fonts;
        if (fonts?.ready) fonts.ready.then(() => win.print()).catch(() => win.print());
        else win.print();
      },
    }));

    useEffect(() => {
      let cancelled = false;
      const t = setTimeout(async () => {
        await putDraft(doc);
        if (!cancelled && frameRef.current) {
          // cache-bust query forces a reload; /render ignores unknown params (draft mode)
          frameRef.current.src = `/render?t=${Date.now()}`;
        }
      }, debounceMs);
      return () => { cancelled = true; clearTimeout(t); };
    }, [doc, debounceMs]);

    return (
      <iframe
        ref={frameRef}
        title="Преглед като списание"
        className="w-full h-full border border-gray-200 rounded-lg bg-white"
      />
    );
  }
);
