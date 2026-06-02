import type { ArticleDoc } from './document-model';

// IndexedDB-backed handoff for the magazine preview of an UNSAVED draft.
// sessionStorage can't hold articles with embedded (base64) images — it overflows
// its ~5MB quota — so the draft doc is stashed in IndexedDB instead.

const DB_NAME = 'mag_pdf_handoff';
const STORE = 'draft';
const KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putDraft(doc: ArticleDoc): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(doc, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getDraft(): Promise<ArticleDoc | null> {
  const db = await openDb();
  try {
    return await new Promise<ArticleDoc | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as ArticleDoc) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
