"use client";

import type { PendingAttendanceItem } from "@/features/attendance/types/attendanceTypes";

const DATABASE_NAME = "chau-tuan-attendance";
const DATABASE_VERSION = 1;
const STORE_NAME = "pending-events";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Không thể mở bộ nhớ chấm công."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "clientEventId" });
        store.createIndex("ownerAccountId", "ownerAccountId", { unique: false });
        store.createIndex("syncState", "syncState", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transactStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    let result: T;
    transaction.oncomplete = () => { database.close(); resolve(result); };
    const failed = () => { database.close(); reject(transaction.error ?? new Error("Không thể truy cập hàng đợi.")); };
    transaction.onerror = failed;
    transaction.onabort = failed;
    // A successful put request is not yet a durable commit. Only acknowledge
    // attendance after IndexedDB has completed its transaction.
    action(transaction.objectStore(STORE_NAME), (value) => { result = value; }, reject);
  });
}

export function savePendingAttendance(item: PendingAttendanceItem): Promise<void> {
  return transactStore("readwrite", (store, resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function removePendingAttendance(clientEventId: string): Promise<void> {
  return transactStore("readwrite", (store, resolve, reject) => {
    const request = store.delete(clientEventId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function listPendingAttendance(accountId: string): Promise<PendingAttendanceItem[]> {
  return transactStore("readonly", (store, resolve, reject) => {
    const request = store.index("ownerAccountId").getAll(accountId);
    request.onsuccess = () => resolve(sortPendingAttendance((request.result ?? []) as PendingAttendanceItem[]));
    request.onerror = () => reject(request.error);
  });
}

export function sortPendingAttendance(items: PendingAttendanceItem[]): PendingAttendanceItem[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientEventId.localeCompare(b.clientEventId));
}

export async function countPendingAttendance(accountId: string): Promise<number> {
  return transactStore("readonly", (store, resolve, reject) => {
    const request = store.index("ownerAccountId").count(accountId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
