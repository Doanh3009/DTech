import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardReadModel } from "../types";
import { DashboardView } from "./DashboardView";

const viewport = vi.hoisted(() => ({ mobile: false }));

vi.mock("@/components/providers/CurrentUserProvider", () => ({ useCurrentUser: () => ({ displayName: "Nguyễn Thị Mai", username: "mai" }) }));
vi.mock("@/components/shared/ModuleLauncher", () => ({ ModuleLauncher: () => <section aria-label="Ứng dụng của tôi"><h2>Ứng dụng của tôi</h2><a href="/personal">Cá nhân</a></section> }));
vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: () => undefined }));
vi.mock("@/lib/ui/useMobileViewport", () => ({ useMobileViewport: () => viewport.mobile }));
beforeEach(() => { viewport.mobile = false; });
afterEach(cleanup);

describe("dashboard greeting and panels", () => {
  it("keeps accounting reporting periods visible when no payroll has been closed yet", () => {
    const model: DashboardReadModel = {
      profile: "accounting", profileLabel: "Kế toán", generatedAt: "2026-10-16T01:00:00Z", attention: [],
      widgets: [{ key: "accounting_summary", label: "Kế toán", status: "ready", data: { charts: [
        { key: "payroll-fund", title: "Thực nhận đã chốt", context: "05/2026 – 10/2026", emptyLabel: "Chưa có kỳ lương đã chốt trong 6 tháng này", series: [] },
        { key: "payslip-status", title: "Tiếp nhận phiếu lương", emptyLabel: "Chưa có phiếu lương đã phát hành", series: [] }
      ] } }]
    };
    render(<DashboardView initialModel={model} />);
    expect(screen.getByRole("heading", { name: "Thực nhận đã chốt" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tiếp nhận phiếu lương" })).toBeInTheDocument();
    expect(screen.getByText("05/2026 – 10/2026")).toBeInTheDocument();
  });
  it("greets the signed-in account and omits activity from an older read model", () => {
    const model: DashboardReadModel = {
      profile: "management", profileLabel: "Điều hành", generatedAt: "2026-10-12T01:00:00Z", attention: [],
      widgets: [{ key: "recent_activity", label: "Hoạt động gần đây", status: "ready", data: { items: [{ id: "one", type: "audit", title: "Hoạt động cũ", href: "/settings/audit-log" }] } }]
    };
    render(<DashboardView initialModel={model} />);
    expect(screen.getByRole("heading", { name: "Chào, Nguyễn Thị Mai", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Hoạt động gần đây")).not.toBeInTheDocument();
    expect(screen.queryByText("Hoạt động cũ")).not.toBeInTheDocument();
  });
  it.each([false, true])("keeps analytics focused without repeating the application strip (mobile: %s)", (mobile) => {
    viewport.mobile = mobile;
    const model: DashboardReadModel = {
      profile: "hr", profileLabel: "Nhân sự", generatedAt: "2026-10-12T01:00:00Z", attention: [],
      widgets: [{ key: "hr_summary", label: "Nhân sự", status: "ready", data: { metrics: [{ label: "Tổng nhân viên", value: 50 }] } }]
    };
    const { container } = render(<DashboardView initialModel={model} />);
    const launcher = container.querySelector("[data-dashboard-applications]");
    const greeting = screen.getByRole("heading", { name: "Chào, Nguyễn Thị Mai", level: 1 });
    const overview = screen.getByRole("heading", { name: "Quy mô đội ngũ" });

    expect(launcher).toBeNull();
    expect(greeting.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ứng dụng của tôi" })).not.toBeInTheDocument();
    expect(screen.getByText("Tổng nhân viên")).toBeInTheDocument();
  });
});
