import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PayrollPeriod } from "../types";
import { PayrollConsole } from "./PayrollConsole";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/shared/DataTable", () => ({ DataTable: ({ data, actions }: { data: PayrollPeriod[]; actions?: (item: PayrollPeriod) => React.ReactNode }) => <div role="table" aria-label="Danh sách kỳ lương">{data.map(item => <div role="row" key={item.id}><span>{item.id}</span>{actions?.(item)}</div>)}</div> }));
const base = { rowVersion: 1, lineCount: 1, grossTotal: 13_500_000, deductionTotal: 200_000, netTotal: 13_300_000, updatedAt: "2026-10-16T00:00:00Z" };
const periods: PayrollPeriod[] = [{ ...base, id: "draft", periodMonth: "2026-10-01", status: "draft" }, { ...base, id: "locked", periodMonth: "2026-09-01", status: "locked" }, { ...base, id: "published", periodMonth: "2026-08-01", status: "published" }];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockReset(); });
describe("accountant payroll queue", () => {
  it("honors the dashboard pending filter including a locked payroll and exposes the real next action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: periods }) })));
    render(<PayrollConsole canCreate={false} initialStatus="pending" />);
    const list = screen.getByRole("table", { name: "Danh sách kỳ lương" });
    await waitFor(() => expect(within(list).getAllByRole("row")).toHaveLength(2));
    expect(within(list).getByRole("link", { name: "Gửi phiếu lương" })).toHaveAttribute("href", "/accounting/payroll/locked");
    expect(within(list).getByRole("link", { name: "Duyệt lương" })).toHaveAttribute("href", "/accounting/payroll/draft");
    expect(within(list).queryByText("published")).not.toBeInTheDocument();
  });
  it("honors the locked filter and switches to all published periods through queue buttons", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: periods }) })));
    render(<PayrollConsole canCreate={false} initialStatus="locked" />);
    const list = screen.getByRole("table", { name: "Danh sách kỳ lương" });
    await waitFor(() => expect(within(list).getAllByRole("row")).toHaveLength(1));
    expect(within(list).getByText("locked")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đã phát hành phiếu 1" }));
    expect(within(list).getByText("published")).toBeInTheDocument();
    expect(within(list).queryByText("locked")).not.toBeInTheDocument();
  });
  it("searches the displayed month while an invalid initial filter falls back to all statuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: periods }) })));
    render(<PayrollConsole canCreate={false} initialStatus="untrusted" />);
    const list = screen.getByRole("table", { name: "Danh sách kỳ lương" });
    await waitFor(() => expect(within(list).getAllByRole("row")).toHaveLength(3));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm kỳ lương" }), { target: { value: "09/2026" } });
    expect(within(list).getAllByRole("row")).toHaveLength(1);
    expect(within(list).getByText("locked")).toBeInTheDocument();
  });
  it("retains a published period with queued delivery failures in the pending work list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: periods.map(item => item.status === "published" ? { ...item, pendingDeliveryCount: 2 } : item) }) })));
    render(<PayrollConsole canCreate={false} initialStatus="pending" />);
    const list = screen.getByRole("table", { name: "Danh sách kỳ lương" });
    await waitFor(() => expect(within(list).getAllByRole("row")).toHaveLength(3));
    expect(within(list).getByRole("link", { name: "Gửi lại phiếu lương" })).toHaveAttribute("href", "/accounting/payroll/published");
    expect(screen.getByRole("button", { name: "Đã phát hành phiếu 1" })).toBeInTheDocument();
  });
  it("loads automatic handoffs without manual creation or reference selection", async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: Boolean(url), json: async () => ({ data: periods }) }));
    vi.stubGlobal("fetch", fetchMock); render(<PayrollConsole canCreate />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/accounting/payroll");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
