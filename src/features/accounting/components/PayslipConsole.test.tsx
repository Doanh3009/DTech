import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PayslipConsole } from "./PayslipConsole";
import type { Payslip } from "../types";

const viewport = vi.hoisted(() => ({ value: true as boolean | null }));
vi.mock("@/lib/ui/useMobileViewport", () => ({ useMobileViewport: () => viewport.value }));

beforeEach(() => { viewport.value = true; });
afterEach(() => vi.unstubAllGlobals());

describe("mobile payslip scope", () => {
  it("uses the personal scope when explicitly selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<PayslipConsole canRevoke selfOnly />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/accounting/payslips?scope=self", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) })));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/v1/accounting/payslips", expect.anything());
  });

  it("shows a loading status until the requested scope has loaded", async () => {
    let complete!: (response: object) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { complete = resolve; })));
    render(<PayslipConsole canRevoke={false} selfOnly />);

    expect(screen.getByRole("status", { name: "Đang tải dữ liệu" })).toBeInTheDocument();
    expect(screen.queryByText("Chưa có phiếu lương")).not.toBeInTheDocument();
    await waitFor(() => expect(complete).toBeTypeOf("function"));
    await act(async () => { complete({ ok: true, json: async () => ({ data: [] }) }); });

    expect(screen.queryByRole("status", { name: "Đang tải dữ liệu" })).not.toBeInTheDocument();
    expect(screen.getByText("Chưa có phiếu lương")).toBeInTheDocument();
  });

  it("shows an error instead of waiting indefinitely when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Không thể tải phiếu lương")));
    render(<PayslipConsole canRevoke={false} selfOnly />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải phiếu lương"));
    expect(screen.queryByRole("status", { name: "Đang tải dữ liệu" })).not.toBeInTheDocument();
  });

  it("loads the route scope without waiting for the viewport to hydrate", async () => {
    viewport.value = null;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<PayslipConsole canRevoke={false} />);
    expect(screen.getByRole("status", { name: "Đang tải dữ liệu" })).toBeInTheDocument();
    expect(screen.queryByText("Chưa có phiếu lương")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/accounting/payslips", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) })));
  });
});

const slip = (overrides: Partial<Payslip> = {}): Payslip => ({ id: "issued", payrollLineId: "line-1", employeeId: "employee-1", employeeCode: "NV001", employeeName: "Nguyễn Văn An", periodMonth: "2026-09-01", version: 2, status: "published", snapshot: { netSalary: 13_300_000 }, publishedAt: "2026-10-01T03:00:00Z", ...overrides });
function mockItems(items: Payslip[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: items }) }));
}

describe("payslip worklist", () => {
  it("shows one current version per person in the selected month", async () => {
    mockItems([slip(), slip({ id: "old", version: 1, status: "revoked", snapshot: { netSalary: 12_000_000 } }), slip({ id: "future", employeeName: "Future employee", periodMonth: "2099-01-01" })]);
    render(<PayslipConsole canRevoke initialMonth="2026-09" />);
    await screen.findByRole("table", { name: "Phiếu lương hiện hành" });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByText("Future employee")).not.toBeInTheDocument();
    expect(screen.getByText("Phiên bản 2")).toBeInTheDocument();
    expect(screen.queryByText("Phiên bản 1")).not.toBeInTheDocument();
    expect(screen.getByText("1 phiếu · 09/2026")).toBeInTheDocument();
  });

  it("keeps revoked versions available in a separate history drawer", async () => {
    mockItems([slip(), slip({ id: "old", version: 1, status: "revoked", revokeReason: "Điều chỉnh lương tháng" })]);
    render(<PayslipConsole canRevoke initialMonth="2026-09" />);
    fireEvent.click(await screen.findByRole("button", { name: "2 bản" }));
    const dialog = await screen.findByRole("dialog", { name: "Lịch sử phiếu lương" });
    expect(within(dialog).getByText("Phiên bản 1")).toBeInTheDocument();
    expect(within(dialog).getByText("Phiên bản 2")).toBeInTheDocument();
    expect(within(dialog).getByText("Điều chỉnh lương tháng")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Xem phiên bản 1" })).toHaveAttribute("href", "/accounting/payslips/old?month=2026-09");
  });

  it("opens dashboard receipt filters without mixing unseen and viewed pending slips", async () => {
    mockItems([slip({ employeeName: "Chưa xem", employeeId: "one" }), slip({ id: "pending", employeeName: "Đã mở phiếu", employeeId: "two", viewedAt: "2026-10-01T05:00:00Z" }), slip({ id: "confirmed", employeeName: "Đã xác nhận phiếu", employeeId: "three", confirmedAt: "2026-10-01T05:00:00Z" })]);
    render(<PayslipConsole canRevoke initialMonth="2026-09" initialReceipt="pending" />);
    await screen.findByRole("table", { name: "Phiếu lương hiện hành" });
    expect(screen.getByRole("link", { name: /Đã mở phiếu/ })).toHaveAttribute("href", "/accounting/payslips/pending?month=2026-09&receipt=pending");
    expect(screen.queryByRole("link", { name: /Đã xác nhận phiếu/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Chưa xem 1/ }));
    expect(screen.getByRole("link", { name: /Chưa xem NV001/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Đã mở phiếu/ })).not.toBeInTheDocument();
  });

  it("paginates current slips and resets the page after a search", async () => {
    mockItems(Array.from({ length: 25 }, (_, index) => slip({ id: `slip-${index}`, employeeId: `employee-${index}`, employeeName: `Nhân viên ${String(index).padStart(2, "0")}` })));
    render(<PayslipConsole canRevoke={false} initialMonth="2026-09" />);
    await screen.findByRole("table", { name: "Phiếu lương hiện hành" });
    expect(screen.getAllByRole("row")).toHaveLength(21);
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    expect(screen.getAllByRole("row")).toHaveLength(6);
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm phiếu lương" }), { target: { value: "Nhân viên 00" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Nhân viên 00/ })).toBeInTheDocument();
  });

  it("does not expose team actions or team employee columns in the personal scope", async () => {
    mockItems([slip()]);
    render(<PayslipConsole canRevoke personalRoute selfOnly initialMonth="2026-09" />);
    await screen.findByRole("table", { name: "Phiếu lương hiện hành" });
    expect(screen.queryByRole("columnheader", { name: "Nhân viên" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "09/2026" })).toHaveAttribute("href", "/personal/payslips/issued?month=2026-09");
    expect(screen.queryByText("Thu hồi")).not.toBeInTheDocument();
  });

  it("preserves the revoke reason and shows a local error when saving fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: [slip()] }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Không thể thu hồi phiếu lương." } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<PayslipConsole canRevoke initialMonth="2026-09" />);
    fireEvent.click(await screen.findByRole("button", { name: "Thao tác phiếu lương Nguyễn Văn An" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Thu hồi" }));
    const dialog = await screen.findByRole("dialog", { name: "Thu hồi phiếu lương" });
    const reason = within(dialog).getByRole("textbox", { name: "Lý do thu hồi" });
    expect(reason).toHaveAttribute("maxlength", "500");
    fireEvent.change(reason, { target: { value: "Điều chỉnh phụ cấp" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Không thể thu hồi phiếu lương.");
    expect(reason).toHaveValue("Điều chỉnh phụ cấp");
    expect(within(dialog).getByRole("button", { name: "Thu hồi phiếu lương" })).not.toBeDisabled();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/accounting/payslips/issued", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ reason: "Điều chỉnh phụ cấp" }) }));
  });
});
