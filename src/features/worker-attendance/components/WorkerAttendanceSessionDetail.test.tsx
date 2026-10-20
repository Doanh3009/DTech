import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@/lib/auth/permissions";
import type { WorkerAttendanceSession } from "../types/workerAttendanceTypes";

const state = vi.hoisted(() => ({ permissions: [] as Permission[] }));
vi.mock("@/components/providers/CurrentUserProvider", () => ({ useCurrentUser: () => ({ permissions: state.permissions }) }));
vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
vi.mock("../client/workerAttendanceSync", () => ({ fetchWorkerSession: vi.fn(), readWorkerResponse: vi.fn() }));
vi.mock("@/features/attendance/components/AttendanceLocationAddress", () => ({ AttendanceLocationAddress: () => <span>Vị trí công trường</span> }));

import { fetchWorkerSession, readWorkerResponse } from "../client/workerAttendanceSync";
import { WorkerAttendanceSessionDetail } from "./WorkerAttendanceSessionDetail";

function fixture(patch: Partial<WorkerAttendanceSession> = {}): WorkerAttendanceSession {
  return {
    id: "session-1", clientSessionId: "client-1", projectId: "project-1", projectName: "Công trường kiểm thử", worksiteId: "site-1", worksiteName: "Khu A",
    date: "2026-10-15", shiftCode: "DAY", shiftName: "Ca ngày", sessionType: "morning", supervisorEmployeeId: "supervisor-1", supervisorName: "Giám sát",
    startedAt: "2026-10-15T01:00:00Z", capturedAtClient: "2026-10-15T01:00:00Z", geofenceStatus: "not_required", status: "in_progress", syncStatus: "synced", photoStatus: "not_required", version: 1,
    photos: [], adjustments: [], checklist: [], checklistResponses: [],
    entries: [{ id: "entry-1", sessionId: "session-1", workerId: "worker-1", employeeCode: "CN01", workerName: "Công nhân 01", assignmentRole: "worker", status: "late", dayException: "none", isUnplanned: false }], ...patch
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.permissions = ["worker_attendance.create", "worker_attendance.view"];
  vi.mocked(fetchWorkerSession).mockResolvedValue(fixture());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("worker attendance session actions", () => {
  it("continues an unfinished roster and does not offer close-day before attendance is submitted", async () => {
    render(<WorkerAttendanceSessionDetail sessionId="session-1" />);
    expect(await screen.findByRole("link", { name: "Tiếp tục điểm danh" })).toHaveAttribute("href", "/worker-attendance/sessions/session-1/roster");
    expect(screen.queryByRole("button", { name: "Chốt công cuối ngày" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh Công nhân 01" })).not.toBeInTheDocument();
  });

  it("offers end-of-day close only after morning attendance is complete", async () => {
    vi.mocked(fetchWorkerSession).mockResolvedValue(fixture({ status: "submitted", submittedAt: "2026-10-15T01:30:00Z" }));
    render(<WorkerAttendanceSessionDetail sessionId="session-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Chốt công cuối ngày" }));
    const drawer = await screen.findByRole("dialog", { name: "Chốt công cuối ngày" });
    expect(within(drawer).getByRole("combobox", { name: "Ngoại lệ" })).toHaveTextContent("Không có");
    expect(within(drawer).getByLabelText("Thời gian")).toBeDisabled();
    fireEvent.click(within(drawer).getByRole("combobox", { name: "Ngoại lệ" }));
    fireEvent.click(await screen.findByRole("option", { name: "Về sớm" }));
    expect(within(drawer).getByLabelText("Thời gian")).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Tiếp tục điểm danh" })).not.toBeInTheDocument();
  });

  it("hides editing and closing for a read-only session", async () => {
    state.permissions = ["worker_attendance.view"];
    vi.mocked(fetchWorkerSession).mockResolvedValue(fixture({ status: "submitted", submittedAt: "2026-10-15T01:30:00Z" }));
    render(<WorkerAttendanceSessionDetail sessionId="session-1" />);
    await screen.findByRole("heading", { name: "Điểm danh công nhân" });
    expect(screen.queryByRole("link", { name: "Tiếp tục điểm danh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chốt công cuối ngày" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Điều chỉnh Công nhân 01" })).not.toBeInTheDocument();
  });

  it("preserves the audited administrator adjustment permission on a locked session", async () => {
    state.permissions = ["worker_attendance.create", "worker_attendance.adjust"];
    vi.mocked(fetchWorkerSession).mockResolvedValue(fixture({ status: "locked", submittedAt: "2026-10-15T01:30:00Z" }));
    render(<WorkerAttendanceSessionDetail sessionId="session-1" />);
    expect(await screen.findByRole("button", { name: "Điều chỉnh Công nhân 01" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Tiếp tục điểm danh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chốt công cuối ngày" })).not.toBeInTheDocument();
  });

  it("opens adjustment at the selected worker's actual status and preserves the form after a failure", async () => {
    state.permissions = ["worker_attendance.adjust", "worker_attendance.view"];
    vi.mocked(fetchWorkerSession).mockResolvedValue(fixture({ status: "submitted", submittedAt: "2026-10-15T01:30:00Z" }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response()));
    vi.mocked(readWorkerResponse).mockRejectedValue(new Error("Mạng tạm gián đoạn"));
    render(<WorkerAttendanceSessionDetail sessionId="session-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Điều chỉnh Công nhân 01" }));
    const drawer = await screen.findByRole("dialog", { name: "Điểm danh · Công nhân 01" });
    expect(within(drawer).getByRole("combobox", { name: "Trạng thái" })).toHaveTextContent("Đi trễ");
    fireEvent.click(within(drawer).getByRole("combobox", { name: "Trạng thái" }));
    fireEvent.click(await screen.findByRole("option", { name: "Có mặt" }));
    fireEvent.change(within(drawer).getByRole("textbox", { name: /Lý do điều chỉnh/ }), { target: { value: "Đã đối chiếu" } });
    fireEvent.submit(drawer.querySelector("form")!);
    expect(await within(drawer).findByRole("alert")).toHaveTextContent("Mạng tạm gián đoạn");
    expect(within(drawer).getByRole("combobox", { name: "Trạng thái" })).toHaveTextContent("Có mặt");
    expect(within(drawer).getByRole("textbox", { name: /Lý do điều chỉnh/ })).toHaveValue("Đã đối chiếu");
    await waitFor(() => expect(within(drawer).getByRole("button", { name: "Lưu điểm danh" })).toBeEnabled());
  });
});
