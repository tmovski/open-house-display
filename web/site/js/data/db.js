/** Small promise wrapper over IndexedDB, the browser's built-in local database. */

export const DB_NAME = 'open-house-display';
const DB_VERSION = 1;

export function openDatabase({ indexedDB = globalThis.indexedDB, name = DB_NAME } = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('leads')) {
        const leads = db.createObjectStore('leads', { keyPath: 'id' });
        leads.createIndex('bySynced', 'synced');
        leads.createIndex('byCreatedAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('The database is open in another tab.'));
  });
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Runs `work(stores)` inside one transaction and resolves when it commits. */
export function transact(db, storeNames, mode, work) {
  return new Promise((resolve, reject) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const tx = db.transaction(names, mode);
    const stores = Object.fromEntries(names.map((n) => [n, tx.objectStore(n)]));
    let result;
    Promise.resolve(work(stores, done)).then(
      (r) => {
        result = r;
      },
      (err) => {
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
        reject(err);
      },
    );
    tx.oncomplete = () => resolve(result);
    // The failing request's error is more specific than the transaction's (which may still be null here).
    tx.onerror = (event) => reject(event.target?.error ?? tx.error ?? new Error('Database write failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}
