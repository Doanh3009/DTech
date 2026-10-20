import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeaveRequestForm } from "./LeaveRequestForm";
import type { LeaveType } from "../types/leaveTypes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/time/timezone", () => ({ getBusinessDateKey: () => "2026-10-15" }));

const annual: LeaveType = { id: "annual", code: "ANNUAL", name: "Phép năm", tone: "success", deductsBalance: false, requiresReason: true, requiresAttachment: false, allowsHalfDay: true, allowsMultiDay: true, workflowId: "flow", active: true };

function setup(type: LeaveType = annual) {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ ok: true, data: url === "/api/v1/leave-types" ? [type] : url.startsWith("/api/v1/leave-balances") ? { balances: [] } : { days: 1 } }) }));
  vi.stubGlobal("fetch", fetcher);
  render(<LeaveRequestForm />);
  return fetcher;
}

async function selectType() {
  fireEvent.click(await screen.findByRole("combobox", { name: "Loại nghỉ" }));
  fireEvent.click(screen.getByRole("option", { name: /Phép năm/ }));
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("leave request form compact date controls", () => {
  it("keeps start and end dates together and hides unused session controls", async () => {
    setup();
    const start = await screen.findByLabelText("Từ ngày");
    expect(start.parentElement?.parentElement).toBe(screen.getByLabelText("Đến ngày").parentElement?.parentElement);
    expect(screen.queryByRole("combobox", { name: /Buổi/ })).not.toBeInTheDocument();
  });

  it("shows one session control for a single day", async () => {
    setup();
    await selectType();
    expect(screen.getByRole("combobox", { name: "Buổi nghỉ" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Buổi kết thúc" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Buổi bắt đầu" })).not.toBeInTheDocument();
  });

  it("reveals both session controls only for a multiday request", async () => {
    setup();
    await selectType();
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-10-16" } });
    expect(screen.getByRole("combobox", { name: "Buổi bắt đầu" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Buổi kết thúc" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-10-15" } });
    expect(screen.getByRole("combobox", { name: "Buổi nghỉ" })).toBeInTheDocument();
  });

  it("keeps full-day types free of disabled session controls", async () => {
    const fetcher = setup({ ...annual, allowsHalfDay: false });
    await selectType();
    expect(screen.queryByRole("combobox", { name: /Buổi/ })).not.toBeInTheDocument();
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/v1/leave-requests/preview", expect.objectContaining({ body: expect.stringContaining('"startDayPart":"full_day"') })));
    expect(fetcher.mock.calls.some(([url]) => url === "/api/v1/leave-requests")).toBe(false);
  });
});
