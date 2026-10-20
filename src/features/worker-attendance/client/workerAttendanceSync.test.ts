import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";
import type { WorkerLocalDraft } from "./workerDraftStore";

vi.mock("./workerDraftStore", () => ({
  deleteWorkerDraft: vi.fn(),
  saveWorkerDraft: vi.fn(),
}));

import { deleteWorkerDraft, saveWorkerDraft } from "./workerDraftStore";
import { syncWorkerDraft } from "./workerAttendanceSync";

const localSessionId = "local-22222222-2222-4222-8222-222222222222";
const serverSessionId = "33333333-3333-4333-8333-333333333333";
const photoId = "44444444-4444-4444-8444-444444444444";

function session(id: string, version: number): WorkerAttendanceSession {
  return {
    id,
    clientSessionId: "22222222-2222-4222-8222-222222222222",
    projectId: "55555555-5555-4555-8555-555555555555",
    projectName: "Dự án A",
    worksiteId: "66666666-6666-4666-8666-666666666666",
    worksiteName: "Công trường A",
    date: "2026-09-14",
    shiftCode: "DAY",
    shiftName: "Ca ngày",
    sessionType: "morning",
    supervisorEmployeeId: "77777777-7777-4777-8777-777777777777",
    supervisorName: "Giám sát",
    startedAt: "2026-09-14T01:00:00.000Z",
    capturedAtClient: "2026-09-14T01:00:00.000Z",
    geofenceStatus: "valid",
    status: "in_progress",
    syncStatus: "synced",
    photoStatus: "pending_upload",
    version,
    entries: [],
    photos: [],
    adjustments: [],
    checklist: [],
    checklistResponses: [],
  };
}

function draft(): WorkerLocalDraft {
  return {
    id: localSessionId,
    ownerAccountId: "88888888-8888-4888-8888-888888888888",
    clientSessionId: "22222222-2222-4222-8222-222222222222",
    session: session(localSessionId, 1),
    photos: [{
      id: photoId,
      photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
      thumbnail: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
      width: 1200,
      height: 900,
      capturedAt: "2026-09-14T01:01:00.000Z",
      uploaded: false,
    }],
    pendingSubmit: false,
    retryCount: 0,
    updatedAt: "2026-09-14T01:00:00.000Z",
  };
}

function apiResponse(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("worker attendance offline synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the client photo operation id after a lost upload response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse({ session: session(serverSessionId, 1) }))
      .mockResolvedValueOnce(apiResponse(session(serverSessionId, 2)))
      .mockRejectedValueOnce(new TypeError("lost response"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(syncWorkerDraft(draft())).rejects.toThrow("lost response");
    const failedDraft = vi.mocked(saveWorkerDraft).mock.calls.at(-1)?.[0];
    expect(failedDraft?.session.id).toBe(serverSessionId);
    expect(failedDraft?.photos[0]?.uploaded).toBe(false);
    expect(deleteWorkerDraft).not.toHaveBeenCalled();

    fetchMock
      .mockResolvedValueOnce(apiResponse(session(serverSessionId, 3)))
      .mockResolvedValueOnce(apiResponse({ ...session(serverSessionId, 4), photoStatus: "uploaded" }));
    await syncWorkerDraft(failedDraft!);

    const uploadCalls = fetchMock.mock.calls.filter(([, init]) => init?.body instanceof FormData);
    expect(uploadCalls).toHaveLength(2);
    expect((uploadCalls[0]?.[1]?.body as FormData).get("photoId")).toBe(photoId);
    expect((uploadCalls[1]?.[1]?.body as FormData).get("photoId")).toBe(photoId);
    expect(deleteWorkerDraft).toHaveBeenCalledWith(localSessionId);
  });
});
