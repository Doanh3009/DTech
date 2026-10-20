import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeaveRequest } from "../types/leaveTypes";
import { LeaveRequestList } from "./LeaveRequestList";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
vi.mock("@/lib/ui/useIsPhone", () => ({ useIsPhone: () => true }));
vi.mock("@/lib/time/timezone", async (load) => ({ ...await load<typeof import("@/lib/time/timezone")>(), getBusinessDateKey: () => "2026-10-14" }));

const request: LeaveRequest = {
  id: "request-1", requestNumber: "LV-0001", employeeId: "employee-1", employeeCode: "NV01", employeeName: "Nguyễn Minh An",
  departmentName: "Kỹ thuật", positionName: "Kỹ sư", leaveTypeId: "annual", leaveTypeName: "Phép năm", deductsBalance: true,
  startDate: "2026-10-14", endDate: "2026-10-16", startDayPart: "full_day", endDayPart: "full_day", calculatedDays: 2,
  reason: "Nghỉ cá nhân", status: "approved", version: 1, createdAt: "2026-10-01T08:00:00.000Z", warnings: [], attachments: [], approvalSteps: [], workingDates: ["2026-10-14", "2026-10-16"]
};

function setup(scope: "self" | "all" | "team" | "approval", items: LeaveRequest[] = [request]) {
  const fetcher = vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => ({ ok: true, data: url === "/api/v1/leave-types" ? [] : items }) }));
  vi.stubGlobal("fetch", fetcher);
  render(<LeaveRequestList scope={scope} />);
  return fetcher;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("leave request list scope", () => {
  it("keeps personal leave compact and queries only the employee scope", async () => {
    const fetcher = setup("self");
    expect(await screen.findByRole("link", { name: "Mở chi tiết" })).toHaveAttribute("href", "/leave/requests/request-1");
    expect(fetcher).toHaveBeenCalledWith("/api/v1/leave-requests?scope=self", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(screen.queryByRole("button", { name: "Lịch nghỉ" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Phòng ban")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Danh sách đơn nghỉ").some((element) => element.classList.contains("mobile-record-list"))).toBe(true);
    expect(screen.getByRole("link", { name: "Tạo đơn nghỉ" })).toHaveAttribute("href", "/leave/new");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["all", "team"] as const)("keeps %s monitoring in the requested scope with monthly boundaries", async (scope) => {
    const fetcher = setup(scope);
    const dayList = await screen.findByRole("region", { name: "Nghỉ ngày 14/10/2026" });
    expect(await within(dayList).findByRole("link")).toHaveAttribute("href", "/leave/manage/request-1");
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/leave-requests?scope=${scope}&startDate=2026-10-01&endDate=2026-10-31`, expect.objectContaining({ cache: "no-store" }));
    expect(screen.getByRole("button", { name: "Lịch nghỉ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Phòng ban")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo đơn nghỉ" })).not.toBeInTheDocument();
  });

  it("excludes nonworking dates from the saved request snapshot", async () => {
    setup("team");
    const excludedDate = await screen.findByRole("button", { name: "15/10/2026, 0 nhân viên nghỉ đã duyệt, 0 chờ duyệt" });
    await screen.findByText("1 đơn · 1 nhân viên");
    fireEvent.click(excludedDate);
    const dayList = screen.getByRole("region", { name: "Nghỉ ngày 15/10/2026" });
    expect(within(dayList).queryByRole("link")).not.toBeInTheDocument();
    expect(within(dayList).getByText("Không có đơn nghỉ cho ngày này")).toBeInTheDocument();
  });

  it("fetches the new month without widening the team scope", async () => {
    const fetcher = setup("team");
    await screen.findByText("1 đơn · 1 nhân viên");
    fireEvent.click(screen.getByRole("button", { name: "Tháng sau" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/v1/leave-requests?scope=team&startDate=2026-11-01&endDate=2026-11-30", expect.anything()));
  });

  it("keeps approval inbox separate from team monitoring", async () => {
    const fetcher = setup("approval", [{ ...request, status: "pending_approval" }]);
    expect(await screen.findByRole("link", { name: "Mở chi tiết" })).toHaveAttribute("href", "/leave/requests/request-1");
    expect(fetcher).toHaveBeenCalledWith("/api/v1/leave-requests?scope=approval", expect.anything());
    expect(screen.queryByRole("button", { name: "Lịch nghỉ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo đơn nghỉ" })).not.toBeInTheDocument();
  });
});
