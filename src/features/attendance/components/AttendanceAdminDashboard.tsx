"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AttendancePhotoReview } from "@/features/attendance/components/AttendancePhotoReview";
import type { AttendanceAdminToday } from "@/features/attendance/types/attendanceTypes";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function AttendanceAdminDashboard({ ownerAccountId }: { ownerAccountId?: string }) {
  const [date, setDate] = useState(today);
  const [data, setData] = useState<AttendanceAdminToday>();
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/attendance/admin/today?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as { data?: AttendanceAdminToday; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải dữ liệu chấm công.");
      if (!controller.signal.aborted) setData(body.data);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu chấm công.");
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [date]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [load]);
  useDomainReconciliation("attendance", load);

  // Never render or inspect evidence left over from a different selected day.
  return <AttendancePhotoReview data={data?.date === date ? data : undefined} date={date} error={error} onDateChange={setDate} onRefresh={load} ownerAccountId={ownerAccountId} refreshing={refreshing} />;
}
