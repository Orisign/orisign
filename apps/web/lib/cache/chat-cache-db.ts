"use client";

import {
  CHAT_CACHE_DB_NAME,
  CHAT_CACHE_SCHEMA_VERSION,
  type ChatCacheRecord,
} from "./chat-cache-types";

const RECORDS_STORE = "records";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isIndexedDbAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function estimateSize(value: unknown) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function openDb() {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(CHAT_CACHE_DB_NAME, CHAT_CACHE_SCHEMA_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        db.createObjectStore(RECORDS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  if (!db) return null;

  return await new Promise<T | null>((resolve) => {
    const tx = db.transaction(RECORDS_STORE, mode);
    const request = run(tx.objectStore(RECORDS_STORE));

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.onerror = () => resolve(null);
  });
}

export async function readRecord<T>(key: string) {
  const record = await withStore<ChatCacheRecord<T>>("readonly", (store) =>
    store.get(key),
  );

  return record?.value;
}

export async function writeRecord<T>(key: string, value: T) {
  const record: ChatCacheRecord<T> = {
    key,
    value,
    updatedAt: Date.now(),
    size: estimateSize(value),
  };

  await withStore("readwrite", (store) => store.put(record));
}

export async function readRecordsByPrefix(prefix: string) {
  const db = await openDb();
  if (!db) return [];

  return await new Promise<ChatCacheRecord<unknown>[]>((resolve) => {
    const tx = db.transaction(RECORDS_STORE, "readonly");
    const store = tx.objectStore(RECORDS_STORE);
    const request = store.openCursor();
    const records: ChatCacheRecord<unknown>[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(records);
        return;
      }

      const record = cursor.value as ChatCacheRecord<unknown>;
      if (record.key.startsWith(prefix)) {
        records.push(record);
      }
      cursor.continue();
    };
    request.onerror = () => resolve(records);
  });
}

export async function deleteRecordsByPrefix(prefix: string) {
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(RECORDS_STORE, "readwrite");
    const store = tx.objectStore(RECORDS_STORE);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const record = cursor.value as ChatCacheRecord<unknown>;
      if (record.key.startsWith(prefix)) {
        cursor.delete();
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function deleteRecordsOlderThan(prefix: string, maxAgeMs: number) {
  const db = await openDb();
  if (!db) return;

  const cutoff = Date.now() - maxAgeMs;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(RECORDS_STORE, "readwrite");
    const store = tx.objectStore(RECORDS_STORE);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const record = cursor.value as ChatCacheRecord<unknown>;
      if (record.key.startsWith(prefix) && record.updatedAt < cutoff) {
        cursor.delete();
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
