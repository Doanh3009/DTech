import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerLocalDraft } from "../client/workerDraftStore";
import type { WorkerEntryStatus } from "../types/workerAttendanceTypes";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../client/workerDraftStore", () => ({ getWorkerDraft: vi.fn(), saveWorkerDraft: vi.fn(), deleteWorkerDraft: vi.fn() }));
vi.mock("../client/workerAttendanceSync", () => ({ fetchWorkerSession: vi.fn(), syncWorkerDraft: vi.fn(), readWorkerResponse: vi.fn() }));

import { getWorkerDraft, saveWorkerDraft } from "../client/workerDraftStore";
import { syncWorkerDraft } from "../client/workerAttendanceSync";
import { WorkerAttendanceWizard } from "./WorkerAttendanceWizard";

function fixture(): WorkerLocalDraft {
  return {
    id: "session-1", ownerAccountId: "account-1", clientSessionId: "client-1", photos: [], pendingSubmit: false, retryCount: 0, updatedAt: "2026-10-12T01:00:00Z",
    session: {
      id: "session-1", clientSessionId: "client-1", projectId: "project-1", projectName: "Công trường kiểm thử", worksiteId: "site-1", worksiteName: "Khu A",
      date: "2026-10-12", shiftCode: "DAY", shiftName: "Ca ngày", sessionType: "morning", supervisorEmployeeId: "supervisor-1", supervisorName: "Giám sát",
      startedAt: "2026-10-12T01:00:00Z", capturedAtClient: "2026-10-12T01:00:00Z", geofenceStatus: "not_required", status: "in_progress", syncStatus: "synced", photoStatus: "not_required", version: 1,
      photos: [], adjustments: [], checklist: [], checklistResponses: [],
      entries: [1, 2].map(number => ({ id: `entry-${number}`, sessionId: "session-1", workerId: `worker-${number}`, employeeCode: `CN0${number}`, workerName: `Công nhân 0${number}`, assignmentRole: "worker", status: "unconfirmed", dayException: "none", isUnplanned: false }))
    }
  };
}

let stored: WorkerLocalDraft;
beforeEach(() => {
  vi.clearAllMocks();
  stored = fixture();
  vi.mocked(getWorkerDraft).mockImplementation(async () => structuredClone(stored));
  vi.mocked(saveWorkerDraft).mockImplementation(async value => { stored = structuredClone(value); });
  vi.mocked(syncWorkerDraft).mockImplementation(async value => value.session);
});
afterEach(cleanup);

async function openRoster() {
  const view = render(<WorkerAttendanceWizard sessionId="session-1" step="roster" />);
  await screen.findByRole("group", { name: "Điểm danh Công nhân 01" });
  return view;
}
function row(number = 1) { return within(screen.getByRole("group", { name: `Điểm danh Công nhân 0${number}` })); }
async function savedStatus(status: WorkerEntryStatus, number = 1) { await waitFor(() => expect(stored.session.entries[number - 1].status).toBe(status)); }

describe("worker roster status buttons", () => {
  it("Có mặt is an actual button and confirms one worker", async () => {
    await openRoster();
    const present = row().getByRole("button", { name: "Có mặt" });
    expect(present).toHaveAttribute("type", "button");
    fireEvent.click(present);
    await savedStatus("present");
    expect(present).toHaveAttribute("aria-pressed", "true");
    expect(row().getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(stored.session.entries[1].status).toBe("unconfirmed");
    expect(screen.getByRole("button", { name: "Tiếp tục 1/2" })).toBeDisabled();
  });

  it.each(["absent", "leave", "late"] as const)("changes %s back to present and clears the previous reason", async status => {
    stored.session.entries[0].status = status;
    stored.session.entries[0].exceptionReason = status === "leave" ? "approved_leave" : "unknown";
    await openRoster();
    fireEvent.click(row().getByRole("button", { name: "Có mặt" }));
    await savedStatus("present");
    expect(stored.session.entries[0].exceptionReason).toBeUndefined();
    expect(row().getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("keeps both workers when two status buttons are tapped rapidly", async () => {
    await openRoster();
    act(() => {
      fireEvent.click(row(1).getByRole("button", { name: "Có mặt" }));
      fireEvent.click(row(2).getByRole("button", { name: "Đi trễ" }));
    });
    await savedStatus("late", 2);
    expect(stored.session.entries[0].status).toBe("present");
    expect(row(1).getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(row(2).getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("Có mặt tất cả preserves approved leave", async () => {
    stored.session.entries[1].status = "leave";
    stored.session.entries[1].exceptionReason = "approved_leave";
    await openRoster();
    fireEvent.click(screen.getByRole("button", { name: "Có mặt tất cả" }));
    await savedStatus("present");
    expect(stored.session.entries[1]).toMatchObject({ status: "leave", exceptionReason: "approved_leave" });
    expect(screen.getByRole("button", { name: "Tiếp tục 2/2" })).toBeEnabled();
  });

  it("removes a confirmed worker from Chưa xử lý without losing their status", async () => {
    await openRoster();
    fireEvent.click(screen.getByRole("button", { name: "Chưa xử lý" }));
    fireEvent.click(row().getByRole("button", { name: "Có mặt" }));
    await savedStatus("present");
    expect(screen.queryByRole("group", { name: "Điểm danh Công nhân 01" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chưa xử lý" }));
    expect(row().getByRole("button", { name: "Có mặt" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the saved selection when reopening the roster", async () => {
    const view = await openRoster();
    fireEvent.click(row().getByRole("button", { name: "Có mặt" }));
    await savedStatus("present");
    view.unmount();
    await openRoster();
    expect(row().getByRole("button", { name: "Có mặt" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports local storage failure and allows saving the selection again", async () => {
    vi.mocked(saveWorkerDraft).mockRejectedValueOnce(new Error("Quota exceeded"));
    await openRoster();
    fireEvent.click(row().getByRole("button", { name: "Có mặt" }));
    await screen.findByText(/Chưa lưu được điểm danh trên thiết bị/);
    fireEvent.click(row().getByRole("button", { name: "Có mặt" }));
    await savedStatus("present");
    expect(screen.queryByText(/Chưa lưu được điểm danh trên thiết bị/)).not.toBeInTheDocument();
  });

  it("waits for draft persistence before syncing and moving to photos", async () => {
    let finishWrite!: () => void;
    vi.mocked(saveWorkerDraft).mockImplementationOnce(value => new Promise<void>(resolve => {
      finishWrite = () => { stored = structuredClone(value); resolve(); };
    }));
    await openRoster();
    fireEvent.click(screen.getByRole("button", { name: "Có mặt tất cả" }));
    await waitFor(() => expect(saveWorkerDraft).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục 2/2" }));
    expect(syncWorkerDraft).not.toHaveBeenCalled();
    await act(async () => finishWrite());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/worker-attendance/sessions/session-1/photos"));
    expect(vi.mocked(syncWorkerDraft).mock.calls[0][0].session.entries.every(entry => entry.status === "present")).toBe(true);
  });

  it("keeps each worker and the focused control in the same position after a tap", async () => {
    await openRoster();
    const first = screen.getByRole("group", { name: "Điểm danh Công nhân 01" });
    const second = screen.getByRole("group", { name: "Điểm danh Công nhân 02" });
    const present = within(first).getByRole("button", { name: "Có mặt" });
    present.focus();
    fireEvent.click(present);
    await savedStatus("present");
    expect(screen.getAllByRole("group", { name: /Điểm danh Công nhân/ })).toEqual([first, second]);
    expect(present).toHaveFocus();
    fireEvent.click(within(first).getByRole("button", { name: "Vắng" }));
    await savedStatus("absent");
    expect(screen.getAllByRole("group", { name: /Điểm danh Công nhân/ })).toEqual([first, second]);
  });

  it("saves an unfinished roster without advancing to photos or closing the day", async () => {
    await openRoster();
    fireEvent.click(row().getByRole("button", { name: "Có mặt" }));
    await savedStatus("present");
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm danh" }));
    await screen.findByText("Đã lưu điểm danh.");
    expect(syncWorkerDraft).toHaveBeenCalledOnce();
    expect(stored.session.entries[1].status).toBe("unconfirmed");
    expect(stored.pendingSubmit).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("preserves the roster order after saving even if the server returns rows reversed", async () => {
    vi.mocked(syncWorkerDraft).mockImplementation(async value => ({ ...value.session, version: 2, entries: [...value.session.entries].reverse() }));
    await openRoster();
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm danh" }));
    await screen.findByText("Đã lưu điểm danh.");
    expect(screen.getAllByRole("group", { name: /Điểm danh Công nhân/ }).map(group => group.getAttribute("aria-label"))).toEqual(["Điểm danh Công nhân 01", "Điểm danh Công nhân 02"]);
    expect(stored.session.version).toBe(2);
  });

  it("keeps an offline save on this screen with the unfinished roster", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValueOnce(false);
    await openRoster();
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm danh" }));
    await screen.findByText("Đã lưu điểm danh trên thiết bị.");
    expect(syncWorkerDraft).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
