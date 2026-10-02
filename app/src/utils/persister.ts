import { openDB } from 'idb';

// v5 @tanstack/react-query-persist-client exports PersistedClient and Persister
// as TypeScript types only — not runtime values. Use inline types to avoid
// the "does not provide an export named" ESM error.
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const DB_NAME = 'vinaraa-query-cache';
const STORE_NAME = 'queries';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export function createIDBPersister(idbValidKey: IDBValidKey = 'reactQuery'): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      const db = await getDB();
      await db.put(STORE_NAME, client, idbValidKey);
    },
    restoreClient: async () => {
      const db = await getDB();
      return await db.get(STORE_NAME, idbValidKey);
    },
    removeClient: async () => {
      const db = await getDB();
      await db.delete(STORE_NAME, idbValidKey);
    },
  };
}
