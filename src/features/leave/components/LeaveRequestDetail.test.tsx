import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { LeaveRequestDetail } from "./LeaveRequestDetail";
import type { LeaveRequest } from "@/features/leave/types/leaveTypes";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); refresh.mockClear(); });

const request: LeaveRequest = {
  id: "request-1", requestNumber: "TEST-LV-0001", employeeId: "employee-1", employeeCode: "NV01",
  employeeName: "Nguyễn Minh An", departmentName: "—", positionName: "", leaveTypeId: "leave-type-1",
  leaveTypeName: "Nghỉ phép năm", deductsBalance: true, startDate: "2026-09-21", endDate: "2026-09-21",
  startDayPart: "full_day", endDayPart: "full_day", calculatedDays: 1, reason: "Nghỉ cá nhân",
  status: "pending_approval", version: 7, createdAt: "2026-09-19T08:00:00.000Z",
  warnings: [], approvalSteps: [], attachments: []
};
const noActions = { submit: false, edit: false, withdraw: false, cancel: false, approve: false, exportPdf: false };
const pendingStep = { id: "step-1", stepOrder: 1, approverSource: "role", status: "pending" as const };
const response = (data: LeaveRequest) => ({ ok: true, json: async () => ({ ok: true, data }) });

function setup(item = request, { scope, permissions = ["leave.self.view"] }: { scope?: "self" | "all"; permissions?: AuthenticatedUser["permissions"] } = {}) {
  const fetcher = vi.fn().mockResolvedValue(response(item));
  vi.stubGlobal("fetch", fetcher);
  render(<CurrentUserProvider user={{ id: "account-1", displayName: "Nhân viên", username: "employee", email: "employee@example.com", status: "active", permissions }}><LeaveRequestDetail id="request-1" scope={scope} /></CurrentUserProvider>);
  return fetcher;
}

describe("leave request detail", () => {
  it("uses the explicitly personal route scope and an abortable request", async () => {
    const fetcher = setup(request, { scope: "self" });
    await screen.findByRole("heading", { name: "Nghỉ phép năm" });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/leave-requests/request-1?scope=self", { cache: "no-store", signal: expect.any(AbortSignal) });
  });

  it("keeps the management route scope regardless of the viewer's personal permission", async () => {
    const fetcher = setup();
    await screen.findByRole("heading", { name: "Nghỉ phép năm" });
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/leave-requests/request-1");
  });

  it("shows the request identity while omitting empty optional fields and an absent approval step", async () => {
    setup(request, { permissions: ["leave.approve_all"] });
    await screen.findByRole("heading", { name: "Nghỉ phép năm" });
    expect(screen.getByText("TEST-LV-0001")).toBeInTheDocument();
    expect(screen.getByText("21/09/2026 · Cả ngày")).toBeInTheDocument();
    expect(screen.queryByText("Phòng ban")).not.toBeInTheDocument();
    expect(screen.queryByText("Chức vụ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Duyệt$/ })).not.toBeInTheDocument();
  });

  it("honors a denied server approval capability even when the user has global approval permission", async () => {
    setup({ ...request, approvalSteps: [pendingStep], availableActions: noActions }, { permissions: ["leave.approve_all"] });
    await screen.findByRole("heading", { name: "Tiến trình duyệt" });
    expect(screen.queryByRole("button", { name: /^Duyệt$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it("opens confirmation for a server-authorized approver and submits the captured request version", async () => {
    const fetcher = setup({ ...request, approvalSteps: [pendingStep], availableActions: { ...noActions, approve: true } });
    fireEvent.click(await screen.findByRole("button", { name: /^Duyệt$/ }));
    const dialog = await screen.findByRole("dialog", { name: "Duyệt đơn nghỉ" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Ý kiến" }), { target: { value: "  Đồng ý  " } });
    fetcher.mockResolvedValueOnce(response({ ...request, status: "approved", availableActions: noActions }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt đơn nghỉ" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenLastCalledWith("/api/v1/leave-requests/request-1/approve", expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 7, comment: "Đồng ý" }) }));
  });

  it("requires a reason before rejecting a request", async () => {
    setup({ ...request, approvalSteps: [pendingStep], availableActions: { ...noActions, approve: true } });
    fireEvent.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = await screen.findByRole("dialog", { name: "Từ chối đơn nghỉ" });
    const submit = within(dialog).getByRole("button", { name: "Từ chối đơn nghỉ" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do/ }), { target: { value: "Chưa bàn giao công việc" } });
    expect(submit).toBeEnabled();
  });

  it("shows draft actions only from the server capabilities", async () => {
    setup({ ...request, status: "draft", availableActions: { ...noActions, submit: true, edit: true, exportPdf: true } });
    expect(await screen.findByRole("button", { name: "Gửi duyệt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sửa đơn nháp" })).toHaveAttribute("href", "/leave/requests/request-1/edit");
    expect(screen.getByRole("link", { name: "Xuất PDF" })).toHaveAttribute("href", "/api/v1/leave-requests/request-1/pdf");
    expect(screen.queryByRole("button", { name: "Hủy đơn" })).not.toBeInTheDocument();
  });

  it("rejects an unsuccessful API envelope and lets the user retry", async () => {
    const fetcher = setup();
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, error: { message: "Phiên đã hết hạn" } }) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Phiên đã hết hạn");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { name: "Nghỉ phép năm" })).toBeInTheDocument();
  });
});
