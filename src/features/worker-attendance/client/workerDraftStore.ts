"use client";

import type { WorkerAttendancePolicy, WorkerAttendanceSession, WorkerAttendanceTask } from "@/features/worker-attendance/types/workerAttendanceTypes";

export interface LocalWorkerPhoto {
  id: string;
  photo: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  capturedAt: string;
  uploaded: boolean;
}

export interface WorkerLocalDraft {
  id: string;
  ownerAccountId: string;
  clientSessionId: string;
  session: WorkerAttendanceSession;
  location?: { latitude: number; longitude: number; accuracy: number };
  photos: LocalWorkerPhoto[];
  pendingSubmit: boolean;
  retryCount: number;
  updatedAt: string;
}

export interface CachedWorkerTasks {
  key: string;
  accountId: string;
  date: string;
  tasks: WorkerAttendanceTask[];
  policy: WorkerAttendancePolicy;
  cachedAt: string;
}

const DATABASE = "chau-tuan-worker-attendance";
const VERSION = 1;
const DRAFTS = "drafts";
const TASKS = "tasks";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFTS)) database.createObjectStore(DRAFTS, { keyPath: "id" });
      if (!database.objectStoreNames.contains(TASKS)) database.createObjectStore(TASKS, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
    action(transaction.objectStore(storeName), resolve, reject);
  });
}

export function saveWorkerDraft(draft: WorkerLocalDraft): Promise<void> {
  return transact(DRAFTS, "readwrite", (store, resolve, reject) => { const request = store.put(draft); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}

export function getWorkerDraft(id: string): Promise<WorkerLocalDraft | undefined> {
  return transact(DRAFTS, "readonly", (store, resolve, reject) => { const request = store.get(id); request.onsuccess = () => resolve(request.result as WorkerLocalDraft | undefined); request.onerror = () => reject(request.error); });
}

export function deleteWorkerDraft(id: string): Promise<void> {
  return transact(DRAFTS, "readwrite", (store, resolve, reject) => { const request = store.delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}

export function listWorkerDrafts(): Promise<WorkerLocalDraft[]> {
  return transact(DRAFTS, "readonly", (store, resolve, reject) => { const request = store.getAll(); request.onsuccess = () => resolve(request.result as WorkerLocalDraft[]); request.onerror = () => reject(request.error); });
}

export function cacheWorkerTasks(cache: CachedWorkerTasks): Promise<void> {
  return transact(TASKS, "readwrite", (store, resolve, reject) => { const request = store.put(cache); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}

export function getCachedWorkerTasks(accountId: string, date: string): Promise<CachedWorkerTasks | undefined> {
  return transact(TASKS, "readonly", (store, resolve, reject) => { const request = store.get(`${accountId}:${date}`); request.onsuccess = () => resolve(request.result as CachedWorkerTasks | undefined); request.onerror = () => reject(request.error); });
}

export function getLatestCachedWorkerTasks(date: string): Promise<CachedWorkerTasks | undefined> {
  return transact(TASKS, "readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const matches = (request.result as CachedWorkerTasks[]).filter((item) => item.date === date).sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
      resolve(matches[0]);
    };
    request.onerror = () => reject(request.error);
  });
}
