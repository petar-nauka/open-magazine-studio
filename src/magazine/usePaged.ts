import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Previewer } from 'pagedjs';
import { fillPageGaps } from './fill-page-gaps';

// Runs Paged.js over the rendered source element, writing paginated pages into `target`.
// Returns whether pagination has finished (used to gate the print button).
// `accent` is set on :root because CSS custom properties used inside @page margin-boxes
// (the running header) do not inherit from document elements — they resolve against :root.
export function usePaged(
  sourceRef: RefObject<HTMLElement>,
  targetRef: RefObject<HTMLElement>,
  accent: string,
  enabled: boolean,
): boolean {
  const done = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || done.current || !sourceRef.current || !targetRef.current) return;
    done.current = true;
    document.documentElement.style.setProperty('--accent', accent);
    const source = sourceRef.current;
    const target = targetRef.current;
    const sourceHtml = source.innerHTML;
    target.innerHTML = '';

    (async () => {
      // Paginate only AFTER fonts and images are ready. Paged.js measures column
      // heights up front; laying out with a fallback font or zero-size images and
      // swapping the real ones in afterwards causes overflow and clipping.
      try { await document.fonts.ready; } catch { /* paginate anyway */ }
      const imgs = Array.from(source.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }),
        ),
      );
      const previewer = new Previewer();
      await previewer.preview(sourceHtml, ['/fonts/fonts.css', '/magazine.css'], target);
      // Let trailing images/ads absorb the empty band at the bottom of each
      // page — before data-paged-ready, so print and PDF export see the result.
      fillPageGaps(target);
      document.body.setAttribute('data-paged-ready', 'true');
      setReady(true);
    })();
  }, [sourceRef, targetRef, accent, enabled]);
  return ready;
}
