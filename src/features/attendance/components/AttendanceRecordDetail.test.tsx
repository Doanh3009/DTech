import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceRecordDetail } from "@/features/attendance/components/AttendanceRecordDetail";

describe("AttendanceRecordDetail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the employee attendance return context while loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<AttendanceRecordDetail backHref="/employees/employee-1/attendance" id="record-1" />);
    expect(screen.getByRole("link", { name: "Trở lại" })).toHaveAttribute("href", "/employees/employee-1/attendance");
  });
});
