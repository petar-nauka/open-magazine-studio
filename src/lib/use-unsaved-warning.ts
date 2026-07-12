import { useEffect } from 'react';

// Warn the user with the browser's native dialog before they close/reload the
// tab (or navigate away via the address bar) while the editor has unsaved
// changes. This intentionally does NOT block in-app <Link> navigation — that
// requires a data router (createBrowserRouter/useBlocker); migrating the router
// is a larger, riskier change kept out of this fix. Closing/reloading is the
// most destructive case and is fully covered here.
export function useUnsavedChangesWarning(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // required for Chrome to show the prompt
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
