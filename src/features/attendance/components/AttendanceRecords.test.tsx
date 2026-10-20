import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceRecords } from "./AttendanceRecords";
import type { AttendanceEvent } from "@/features/attendance/types/attendanceTypes";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
vi.mock("@/lib/ui/useIsPhone", () => ({ useIsPhone: () => false }));

afterEach(() => vi.unstubAllGlobals());

describe("attendance log photo viewing", () => {
  it("opens the photo for a mocked attendance record", async () => {
    const record: AttendanceEvent = {
      id: "event-demo",
      clientEventId: "client-event-demo",
      employeeId: "employee-demo",
      employeeName: "Nguyễn Văn An",
      eventType: "check_in",
      attendanceDate: "2026-10-05",
      effectiveAt: "2026-10-05T08:00:00+07:00",
      capturedAtClient: "2026-10-05T08:00:00+07:00",
      receivedAtServer: "2026-10-05T08:00:02+07:00",
      locationName: "Văn phòng",
      geofenceStatus: "valid",
      attendanceStatus: "recorded",
      photoStatus: "uploaded",
      syncStatus: "synced",
      photoId: "photo-demo",
      anomalyFlags: []
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [record] }) }));

    render(<AttendanceRecords admin />);

    fireEvent.click(await screen.findByRole("button", { name: "Xem ảnh" }));
    const viewer = await screen.findByRole("dialog");
    const image = within(viewer).getByRole("img", { name: "Ảnh chấm công Nguyễn Văn An" });

    expect(image).toHaveAttribute("src", "/api/v1/attendance/photos/photo-demo");
    expect(within(viewer).getByText("Nguyễn Văn An")).toBeInTheDocument();
  });
});
