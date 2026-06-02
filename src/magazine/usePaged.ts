import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Previewer } from 'pagedjs';

// Runs Paged.js over the rendered source element, writing paginated pages into `target`.
// `accent` is set on :root because CSS custom properties used inside @page margin-boxes
// (the running header) do not inherit from document elements — they resolve against :root.
export function usePaged(sourceRef: RefObject<HTMLElement>, targetRef: RefObject<HTMLElement>, accent: string, enabled: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current || !sourceRef.current || !targetRef.current) return;
    done.current = true;
    document.documentElement.style.setProperty('--accent', accent);
    const previewer = new Previewer();
    const sourceHtml = sourceRef.current.innerHTML;
    targetRef.current.innerHTML = '';
    previewer.preview(sourceHtml, ['/fonts/fonts.css', '/magazine.css'], targetRef.current).then(() => {
      document.body.setAttribute('data-paged-ready', 'true');
    });
  }, [sourceRef, targetRef, accent, enabled]);
}
