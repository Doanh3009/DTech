import type { ProjectAssignment, ProjectIssueSeverity, ProjectProgressNode, ProjectUpdate, ProjectUpdateStatus } from "@/features/projects/types/projectTypes";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";

const DATABASE_NAME = "ct-field-operations";
const DATABASE_VERSION = 2;
const STORE_NAME = "field-update-queue";
const SNAPSHOT_STORE_NAME = "project-snapshots";
export const FIELD_QUEUE_CHANGED = "ct:field-queue-changed";

export type FieldQueueStatus = "pending" | "syncing" | "failed";

export interface FieldQueuePhoto {
  id: string;
  blob: Blob;
  name: string;
  type: string;
}

export interface FieldQueueUpdateInput {
  clientUpdateId: string;
  worksiteId?: string;
  updateType: "progress" | "issue";
  title: string;
  content: string;
  status: ProjectUpdateStatus;
  publishStatus: "published";
  issueFlag: boolean;
  issueSeverity?: ProjectIssueSeverity;
  capturedAtClient: string;
}

export interface FieldQueueItem {
  id: string;
  ownerAccountId: string;
  projectId: string;
  worksiteId?: string;
  createdAt: string;
  updatedAt: string;
  status: FieldQueueStatus;
  retryCount: number;
  lastError?: string;
  progressPatch?: ProjectProgressNode;
  progressSynced: boolean;
  update: FieldQueueUpdateInput;
  updateId?: string;
  photos: FieldQueuePhoto[];
  uploadedPhotoIds: string[];
}

export interface FieldProjectSnapshot {
  key: string;
  ownerAccountId: string;
  projectId: string;
  cachedAt: string;
  progressNodes: ProjectProgressNode[];
  updates: ProjectUpdate[];
  roster: ProjectAssignment[];
  attendanceSessions: WorkerAttendanceSession[];
}

function emitChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(FIELD_QUEUE_CHANGED));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("ownerProject", ["ownerAccountId", "projectId"], { unique: false });
      }
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) database.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không thể mở bộ nhớ ngoại tuyến."));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void, storeName = STORE_NAME): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    run(transaction.objectStore(STORE_NAME), resolve, reject);
  });
}

export async function saveFieldProjectSnapshot(snapshot: Omit<FieldProjectSnapshot, "key" | "cachedAt">): Promise<void> {
  await transact<void>("readwrite", (store, resolve, reject) => {
    const request = store.put({ ...snapshot, key: `${snapshot.ownerAccountId}:${snapshot.projectId}`, cachedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }, SNAPSHOT_STORE_NAME);
}

export async function getFieldProjectSnapshot(ownerAccountId: string, projectId: string): Promise<FieldProjectSnapshot | undefined> {
  return transact<FieldProjectSnapshot | undefined>("readonly", (store, resolve, reject) => {
    const request = store.get(`${ownerAccountId}:${projectId}`);
    request.onsuccess = () => resolve(request.result as FieldProjectSnapshot | undefined);
    request.onerror = () => reject(request.error);
  }, SNAPSHOT_STORE_NAME);
}

export async function saveFieldQueueItem(item: FieldQueueItem): Promise<void> {
  await transact<void>("readwrite", (store, resolve, reject) => {
    const request = store.put({ ...item, updatedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  emitChanged();
}

export async function deleteFieldQueueItem(id: string): Promise<void> {
  await transact<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  emitChanged();
}

export async function listFieldQueue(ownerAccountId: string, projectId: string): Promise<FieldQueueItem[]> {
  return transact<FieldQueueItem[]>("readonly", (store, resolve, reject) => {
    const index = store.index("ownerProject");
    const request = index.getAll(IDBKeyRange.only([ownerAccountId, projectId]));
    request.onsuccess = () => resolve((request.result as FieldQueueItem[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

async function readApi<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? fallback);
  return body.data;
}

export async function syncFieldQueueItem(item: FieldQueueItem): Promise<{ nodes?: ProjectProgressNode[] }> {
  let current = { ...item, status: "syncing" as const, lastError: undefined };
  await saveFieldQueueItem(current);
  try {
    let nodes: ProjectProgressNode[] | undefined;
    if (current.progressPatch && !current.progressSynced) {
      nodes = await readApi<ProjectProgressNode[]>(await fetch(`/api/v1/projects/${current.projectId}/progress`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(current.progressPatch)
      }), "Không thể đồng bộ tiến độ.");
      current = { ...current, progressSynced: true };
      await saveFieldQueueItem(current);
    }

    let updateId = current.updateId;
    if (!updateId) {
      const update = await readApi<{ id: string }>(await fetch(`/api/v1/projects/${current.projectId}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(current.update)
      }), "Không thể đồng bộ cập nhật hiện trường.");
      updateId = update.id;
      current = { ...current, updateId };
      await saveFieldQueueItem(current);
    }

    for (const photo of current.photos) {
      if (current.uploadedPhotoIds.includes(photo.id)) continue;
      const payload = new FormData();
      payload.set("file", new File([photo.blob], photo.name, { type: photo.type }));
      payload.set("clientAttachmentId", photo.id);
      await readApi(await fetch(`/api/v1/project-updates/${updateId}/attachments`, { method: "POST", body: payload }), `Không thể tải ${photo.name}.`);
      current = { ...current, uploadedPhotoIds: [...current.uploadedPhotoIds, photo.id] };
      await saveFieldQueueItem(current);
    }

    await deleteFieldQueueItem(current.id);
    return { nodes };
  } catch (reason) {
    await saveFieldQueueItem({
      ...current,
      status: "failed",
      retryCount: current.retryCount + 1,
      lastError: reason instanceof Error ? reason.message : "Không thể đồng bộ."
    });
    throw reason;
  }
}

export async function syncFieldQueue(ownerAccountId: string, projectId: string): Promise<ProjectProgressNode[] | undefined> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return undefined;
  const items = await listFieldQueue(ownerAccountId, projectId);
  let latestNodes: ProjectProgressNode[] | undefined;
  for (const item of items) {
    try {
      const result = await syncFieldQueueItem(item);
      latestNodes = result.nodes ?? latestNodes;
    } catch {
      // A failed item stays in IndexedDB with its error. Continue so one item cannot block the queue.
    }
  }
  return latestNodes;
}

export async function compressFieldPhoto(file: File): Promise<FieldQueuePhoto> {
  const id = crypto.randomUUID();
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") {
    return { id, blob: file, name: file.name, type: file.type };
  }
  const bitmap = await createImageBitmap(file);
  const maximum = 1920;
  const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Không thể xử lý ảnh.")), "image/jpeg", 0.82));
  const base = file.name.replace(/\.[^.]+$/, "") || "hien-truong";
  return { id, blob, name: `${base}.jpg`, type: "image/jpeg" };
}
