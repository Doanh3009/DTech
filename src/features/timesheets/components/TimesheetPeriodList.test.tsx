import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimesheetPeriodList } from "./TimesheetPeriodList";
import type { TimesheetPeriod } from "../types/timesheetTypes";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
vi.mock("@/lib/ui/useIsPhone", () => ({ useIsPhone: () => false }));

describe("timesheet period list", () => {
  it("renders server-provided periods without a second loading request", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const period: TimesheetPeriod = {
      id: "period-demo",
      code: "TEST-2026-10",
      name: "Kỳ công tháng 10 [TEST DATA]",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      status: "open",
      version: 1,
      rowVersion: 1
    };

    render(<TimesheetPeriodList initialItems={[period]} />);

    expect(screen.getByText(period.name)).toBeInTheDocument();
    expect(screen.getByText(period.code)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
