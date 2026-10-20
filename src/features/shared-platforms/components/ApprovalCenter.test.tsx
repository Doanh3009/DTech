import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCenter } from "@/features/shared-platforms/components/ApprovalCenter";
import type { ApprovalCase } from "@/features/shared-platforms/types";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: () => undefined }));

const approval: ApprovalCase = {
  id: "approval-1",
  domainType: "LEAVE",
  domainId: "leave-1",
  referenceNumber: "TEST-LV-0001",
  requesterName: "—",
  summary: "1 ngày nghỉ phép năm",
  domainLink: "/leave/requests/leave-1",
  workflowVersion: 1,
  status: "pending",
  submittedAt: "2026-09-19T08:00:00.000Z",
  waitingHours: 312,
  metadata: {},
  steps: []
};

describe("ApprovalCenter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows only decision-relevant fields and omits reference codes and empty values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [approval] }) }));
    render(<ApprovalCenter view="pending" />);

    const row = await screen.findByRole("button", { name: /1 ngày nghỉ phép năm/ });
    expect(row).toHaveTextContent("Nghỉ phép");
    expect(row).toHaveTextContent("Chờ duyệt");
    expect(row).toHaveTextContent("Chờ 13 ngày");
    expect(screen.queryByText("TEST-LV-0001")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByText("Trạng thái")).toBeInTheDocument();

    fireEvent.click(row);
    const inspector = screen.getByRole("complementary", { name: "Chi tiết yêu cầu" });
    expect(within(inspector).getByRole("link", { name: "Mở yêu cầu" })).toHaveAttribute("href", "/approvals/approval-1");
    expect(within(inspector).queryByText("TEST-LV-0001")).not.toBeInTheDocument();
    expect(within(inspector).queryByText("Người gửi")).not.toBeInTheDocument();
  });
});
