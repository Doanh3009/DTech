"use client";

import { useMemo, useState } from "react";
import { AttendancePhotoReview } from "@/features/attendance/components/AttendancePhotoReview";
import type { AttendanceAdminToday, AttendanceAdminTodayRow, AttendanceEvent, AttendanceType } from "@/features/attendance/types/attendanceTypes";

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

function demoEvent(date: string, employeeId: string, eventType: AttendanceType, clock: string, photoId: string, overrides: Partial<AttendanceEvent> = {}): AttendanceEvent {
  const id = `${date}:${employeeId}:${photoId}`;
  const timestamp = `${date}T${clock}:00+07:00`;
  return {
    id,
    clientEventId: `demo:${id}`,
    employeeId,
    eventType,
    attendanceDate: date,
    effectiveAt: timestamp,
    capturedAtClient: timestamp,
    receivedAtServer: timestamp,
    locationId: "demo-location",
    locationName: "Vị trí mẫu",
    latitude: 10.77,
    longitude: 106.70,
    accuracyMeters: 8,
    distanceMeters: 14,
    geofenceStatus: "valid",
    attendanceStatus: "recorded",
    photoStatus: "uploaded",
    syncStatus: "synced",
    photoId,
    anomalyFlags: [],
    ...overrides
  };
}

function demoData(date: string): AttendanceAdminToday {
  const employee = (number: number, name: string, departmentName: string, departmentId: string): AttendanceAdminTodayRow => ({
    employeeId: `demo-employee-${number}`,
    employeeCode: `DEMO-${String(number).padStart(3, "0")}`,
    employeeName: name,
    departmentId,
    departmentName,
    shiftId: "demo-shift-day",
    shiftName: "Ca ngày · 08:00–17:00",
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    totalMinutes: 540,
    status: "present"
  });
  const pair = (row: AttendanceAdminTodayRow, imageName: string, checkIn: string, checkOut: string, inOverrides: Partial<AttendanceEvent> = {}): AttendanceAdminTodayRow => ({
    ...row,
    totalMinutes: Number(checkOut.slice(0, 2)) * 60 + Number(checkOut.slice(3)) - Number(checkIn.slice(0, 2)) * 60 - Number(checkIn.slice(3)),
    checkIn: `${date}T${checkIn}:00+07:00`,
    checkOut: `${date}T${checkOut}:00+07:00`,
    events: [
      demoEvent(date, row.employeeId, "check_in", checkIn, `${imageName}-in`, inOverrides),
      demoEvent(date, row.employeeId, "check_out", checkOut, `${imageName}-out`)
    ]
  });

  const an = pair(employee(1, "Nguyễn Minh An", "Công trường", "demo-site"), "an", "08:00", "17:00");
  const binh = pair(employee(2, "Trần Ngọc Bình", "Nhân sự", "demo-hr"), "binh", "07:57", "17:10");
  const chi = pair({ ...employee(3, "Lê Thu Chi", "Kỹ thuật", "demo-engineering"), status: "late", lateMinutes: 32, totalMinutes: 510 }, "chi", "08:32", "17:02", {
    accuracyMeters: 128,
    geofenceStatus: "accuracy_low",
    attendanceStatus: "needs_review",
    anomalyFlags: ["gps_accuracy_low"]
  });
  const dung = pair(employee(4, "Phạm Anh Dũng", "Công trường", "demo-site"), "dung", "07:59", "17:06");
  const ha: AttendanceAdminTodayRow = {
    ...employee(5, "Đỗ Quỳnh Hà", "Nhân sự", "demo-hr"),
    status: "missing_check",
    totalMinutes: 0,
    checkIn: `${date}T08:00:00+07:00`,
    events: [demoEvent(date, "demo-employee-5", "check_in", "08:00", "ha-pending", {
      photoId: undefined,
      photoStatus: "pending_upload",
      syncStatus: "local_pending"
    })]
  };
  const khoa = pair(employee(6, "Vũ Quốc Khoa", "Kỹ thuật", "demo-engineering"), "khoa", "07:55", "17:04");
  khoa.events = [
    khoa.events![0],
    demoEvent(date, khoa.employeeId, "check_in", "07:59", "khoa-in-2", {
      attendanceStatus: "needs_review",
      anomalyFlags: ["duplicate_check_in"]
    }),
    khoa.events![1]
  ];
  const lan: AttendanceAdminTodayRow = {
    ...employee(7, "Bùi Mai Lan", "Nhân sự", "demo-hr"),
    status: "leave",
    totalMinutes: 0,
    events: []
  };
  const rows = [an, binh, chi, dung, ha, khoa, lan];

  return {
    date,
    totalEmployees: rows.length,
    present: rows.filter((row) => row.status === "present").length,
    late: rows.filter((row) => row.status === "late").length,
    leave: rows.filter((row) => row.status === "leave").length,
    notChecked: rows.filter((row) => row.status === "not_checked").length,
    missingCheck: rows.filter((row) => row.status === "missing_check").length,
    canViewPhotos: true,
    rows
  };
}

function samplePhotoUrl(event: AttendanceEvent) {
  return `/demo/attendance/${encodeURIComponent(event.photoId ?? "missing")}.svg`;
}

export function AttendancePhotoReviewDemo() {
  const [date, setDate] = useState(today);
  const data = useMemo(() => demoData(date), [date]);
  return <AttendancePhotoReview data={data} date={date} onDateChange={setDate} onRefresh={() => undefined} ownerAccountId="attendance-photo-demo" refreshing={false} resolvePhotoUrl={samplePhotoUrl} />;
}
