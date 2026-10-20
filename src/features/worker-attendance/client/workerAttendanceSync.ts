"use client";

import { deleteWorkerDraft, saveWorkerDraft, type WorkerLocalDraft } from "./workerDraftStore";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";

interface ApiBody<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class WorkerSyncError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export async function readWorkerResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as ApiBody<T>;
  if (!response.ok || !body.ok || body.data === undefined) {
    throw new WorkerSyncError(body.error?.code ?? "NETWORK_ERROR", body.error?.message ?? "Chưa thể đồng bộ.");
  }
  return body.data;
}

export async function fetchWorkerSession(id: string): Promise<WorkerAttendanceSession> {
  return readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${id}`, { cache: "no-store" }));
}

export async function syncWorkerDraft(draft: WorkerLocalDraft): Promise<WorkerAttendanceSession> {
  const syncing = { ...draft, retryCount: draft.retryCount + 1, updatedAt: new Date().toISOString() };
  await saveWorkerDraft(syncing);
  let session = syncing.session;

  try {
    if (session.id.startsWith("local-")) {
      const created = await readWorkerResponse<{ session: WorkerAttendanceSession }>(await fetch("/api/v1/worker-attendance/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSessionId: syncing.clientSessionId,
          projectId: session.projectId,
          worksiteId: session.worksiteId,
          date: session.date,
          shiftCode: session.shiftCode,
          sessionType: session.sessionType,
          capturedAtClient: session.capturedAtClient,
          location: syncing.location
        })
      }));
      session = created.session;
    }

    const localByWorker = new Map(syncing.session.entries.map((entry) => [entry.workerId, entry]));
    const entries = session.entries.map((entry) => {
      const local = localByWorker.get(entry.workerId);
      return {
        id: entry.id,
        status: local?.status ?? entry.status,
        exceptionReason: local?.exceptionReason ?? null,
        dayException: local?.dayException ?? "none",
        exceptionTime: local?.exceptionTime ?? null,
        note: local?.note ?? null
      };
    });
    session = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${session.id}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: session.version, entries, workNote: syncing.session.workNote ?? null, note: syncing.session.note ?? null, checklistResponses: syncing.session.checklistResponses, location: syncing.location })
    }));

    for (const localPhoto of syncing.photos.filter((photo) => !photo.uploaded)) {
      const form = new FormData();
      form.set("photo", localPhoto.photo, "worker-attendance.jpg");
      form.set("thumbnail", localPhoto.thumbnail, "worker-attendance-thumbnail.jpg");
      form.set("photoId", localPhoto.id);
      form.set("width", String(localPhoto.width));
      form.set("height", String(localPhoto.height));
      form.set("capturedAt", localPhoto.capturedAt);
      session = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${session.id}/photos`, { method: "POST", body: form }));
      localPhoto.uploaded = true;
    }

    if (syncing.pendingSubmit) {
      session = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${session.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: session.version })
      }));
    }

    await deleteWorkerDraft(draft.id);
    if (session.status !== "submitted" && session.status !== "locked") {
      await saveWorkerDraft({ ...syncing, id: session.id, session, photos: [], retryCount: 0, updatedAt: new Date().toISOString() });
    }
    return session;
  } catch (error) {
    await saveWorkerDraft({ ...syncing, session: { ...session, syncStatus: "sync_failed" } });
    throw error;
  }
}
