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
        // Wait until the iframe has finished paginating (data-paged-ready) AND its
        // fonts are loaded before printing, so we never capture a blank or half-
        // laid-out page. Poll with a cap so a stuck render still prints eventually.
        const start = Date.now();
        const printWhenReady = () => {
          const body = win.document?.body;
          const paged = body?.getAttribute('data-paged-ready') === 'true';
          if (!paged && Date.now() - start < 8000) {
            setTimeout(printWhenReady, 150);
            return;
          }
          const fonts = win.document?.fonts;
          if (fonts?.ready) fonts.ready.then(() => win.print()).catch(() => win.print());
          else win.print();
        };
        printWhenReady();
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
