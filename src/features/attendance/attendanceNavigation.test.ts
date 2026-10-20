import { describe, expect, it } from "vitest";

import {
  attendanceLogBackHref,
  attendanceRecordBackHref,
  attendanceRecordHref,
} from "@/features/attendance/attendanceNavigation";

describe("attendance navigation", () => {
  it("returns an employee attendance record to the same employee tab", () => {
    const employeeTab = "/employees/employee-1/attendance";
    expect(attendanceRecordBackHref(employeeTab)).toBe(employeeTab);
    expect(attendanceRecordHref("record-1", employeeTab)).toBe(
      "/attendance/records/record-1?returnTo=%2Femployees%2Femployee-1%2Fattendance"
    );
  });

  it("uses the admin attendance log as the safe default", () => {
    expect(attendanceRecordBackHref()).toBe("/attendance/logs");
    expect(attendanceRecordBackHref("https://example.com/phishing")).toBe("/attendance/logs");
    expect(attendanceRecordBackHref("//example.com/phishing")).toBe("/attendance/logs");
  });

  it("returns an employee-filtered log to the same employee attendance tab", () => {
    expect(attendanceLogBackHref("employee/with spaces")).toBe(
      "/employees/employee%2Fwith%20spaces/attendance",
    );
  });

  it("returns the unfiltered admin log to today's attendance list", () => {
    expect(attendanceLogBackHref()).toBe("/attendance/today");
  });
});
