"use client";

import Link from "next/link";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Drawer } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/shared/States";
import { formatBusinessDate } from "@/lib/time/timezone";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { calendarWeeks, dailyLabels, dailySymbols, periodDates, reconcileTimesheet } from "../services/timesheetPresentation";
import type { DailyTimesheet, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";
import styles from "./EmployeeTimesheetMobile.module.css";

const sourceLabels = { SELF_ATTENDANCE: "Tự chấm công", SUPERVISOR_ROSTER: "Điểm danh công trường", APPROVED_LEAVE: "Đơn nghỉ đã duyệt", MANUAL_ADJUSTMENT: "Điều chỉnh nhân sự", SYSTEM_CALENDAR: "Lịch làm việc" };
const time = (value?: string) => value ? new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "—";
const count = (value: number) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "—";
type Detail = { period: TimesheetPeriod; daily: DailyTimesheet[]; summary?: TimesheetSummary };

export function EmployeeTimesheetMobile({ periodId, employeeId, selectedDate, canAdjust = false }: { periodId: string; employeeId: string; selectedDate?: string; canAdjust?: boolean }) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string>();
  const requestVersion = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    try {
      const response = await fetch(`/api/v1/timesheet-periods/${encodeURIComponent(periodId)}`, { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
      const body = await response.json() as { data?: { period: TimesheetPeriod; daily: DailyTimesheet[]; summaries: TimesheetSummary[] }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải công nhân viên.");
      if (signal?.aborted || version !== requestVersion.current) return;
      setDetail({ period: body.data.period, daily: body.data.daily.filter(item => item.employeeId === employeeId || item.employeeCode === employeeId), summary: body.data.summaries.find(item => item.employeeId === employeeId || item.employeeCode === employeeId) });
      setError("");
    } catch (reason) {
      if (!signal?.aborted && version === requestVersion.current) setError(reason instanceof Error ? reason.message : "Không thể tải công nhân viên.");
    }
  }, [periodId, employeeId]);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  useDomainReconciliation("timesheets", load);
  const period = detail?.period;
  const daily = useMemo(() => detail?.daily ?? [], [detail]);
  const summary = detail?.summary;
  const days = useMemo(() => period ? periodDates(period.startDate, period.endDate) : [], [period]);
  const weeks = useMemo(() => calendarWeeks(days), [days]);
  const byDate = useMemo(() => new Map(daily.map(item => [item.workDate, item])), [daily]);
  const selectedDay = selected ?? (selectedDate && days.includes(selectedDate) ? selectedDate : "");
  const record = byDate.get(selectedDay);
  const employeeName = summary?.employeeName ?? daily[0]?.employeeName ?? "Nhân viên";
  if (error && !detail) return <Card><p className="form-error" role="alert">{error}</p><Button onClick={() => void load()}>Thử lại</Button></Card>;
  if (!period) return <LoadingState title="Đang mở công nhân viên" />;
  if (!summary && !daily.length) return <Card>Không tìm thấy nhân viên trong kỳ công</Card>;
  return <div className={styles.workspace}>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <Card className={styles.summary}>
      <div className={styles.identity}><div><h2>{employeeName}</h2><span>{summary?.employeeCode ?? daily[0]?.employeeCode}{(summary?.departmentName ?? daily[0]?.departmentName) ? ` · ${summary?.departmentName ?? daily[0]?.departmentName}` : ""}</span></div><div className={styles.period}><CalendarDays aria-hidden="true" size={18}/><span><strong>{period.name}</strong><small>{formatBusinessDate(period.startDate)} – {formatBusinessDate(period.endDate)}</small></span></div></div>
      {summary ? <dl className={styles.metrics}>{[["Ngày công", summary.actualWorkdays], ["Đi trễ", summary.lateDays], ["Nghỉ phép", summary.annualLeaveDays], ["Không lương", summary.unpaidLeaveDays], ["Vắng", summary.absentDays], ["Ngoại lệ", summary.exceptionCount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{count(value as number)}</dd></div>)}</dl> : null}
    </Card>
    {summary && reconcileTimesheet(summary, daily).mismatch ? <p className={styles.dataAlert} role="status">Chưa đủ dữ liệu công từng ngày</p> : null}
    <Card className={styles.calendar}>
      <div className={styles.calendarHeading}><h2>Lịch công</h2><Button aria-label="Cập nhật lịch công" onClick={() => void load()}><RefreshCw aria-hidden="true" size={16}/></Button></div>
      <div className={styles.weekdays} aria-hidden="true">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day => <span key={day}>{day}</span>)}</div>
      <div className={styles.calendarGrid}>{weeks.flat().map((date, index) => {
        if (!date) return <span aria-hidden="true" key={`blank-${index}`}/>;
        const item = byDate.get(date);
        return <button aria-label={`${formatBusinessDate(date)}: ${item ? dailyLabels[item.status] : "Chưa có dữ liệu"}`} className={`${styles.day} ${item ? styles[item.status] : styles.empty}`} key={date} onClick={() => setSelected(date)} type="button"><span className={styles.dayNumber}>{date.slice(-2)}{date.endsWith("-01") ? <small>/{date.slice(5, 7)}</small> : null}</span><span className={styles.daySymbol}>{item ? dailySymbols[item.status] : "·"}</span></button>;
      })}</div>
      <div className={styles.legend}>{[["X", "Có công"], ["M / S", "Trễ / sớm"], ["P", "Nghỉ phép"], ["KL", "Không lương"], ["V", "Vắng"], ["!", "Cần xử lý"], ["·", "Chưa có dữ liệu"]].map(([symbol, label]) => <span key={symbol}><b>{symbol}</b>{label}</span>)}</div>
    </Card>
    <Drawer open={Boolean(selectedDay)} onClose={() => setSelected("")} title={`${employeeName} · ${selectedDay ? formatBusinessDate(selectedDay) : "Ngày công"}`}>
      <div className={styles.dayDetail}><div className={styles.dayHeading}><strong>{selectedDay ? formatBusinessDate(selectedDay) : "Ngày công"}</strong><StatusBadge tone={record?.exceptionCount ? "warning" : "neutral"}>{record ? dailyLabels[record.status] : "Chưa có dữ liệu"}</StatusBadge></div>
        {record ? <><dl className={styles.facts}>{[["Ca làm", record.shiftName || "—"], ["Giờ ca", record.shiftStart ? `${record.shiftStart} – ${record.shiftEnd || "—"}` : "—"], ["Chấm vào", time(record.effectiveCheckIn)], ["Chấm ra", time(record.effectiveCheckOut)], ["Ngày công", count(record.workFraction)], ["Thời gian làm", `${record.workMinutes} phút`], ["Đi trễ", `${record.lateMinutes} phút`], ["Về sớm", `${record.earlyLeaveMinutes} phút`], ["Nghỉ phép", count(record.leaveFraction)], ["Ngoại lệ", record.exceptionCount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {record.sources.length ? <section><h3>Nguồn dữ liệu</h3><div className={styles.sources}>{record.sources.map(source => <StatusBadge key={source}>{sourceLabels[source]}</StatusBadge>)}</div></section> : null}
        {record.hrNote ? <section><h3>Ghi nhận nhân sự</h3><p>{record.hrNote}</p></section> : null}
        {record.adjustments.length ? <section><h3>Lịch sử điều chỉnh</h3>{record.adjustments.map(item => <div className={styles.adjustment} key={item.id}><strong>{item.reason}</strong><small>{item.createdByName || "Nhân sự"} · {formatBusinessDate(item.createdAt)}</small>{item.hrNote ? <span>{item.hrNote}</span> : null}</div>)}</section> : null}</> : <p className={styles.dataAlert}>Chưa có bản ghi công cho ngày này</p>}
        <div className={styles.actions}>{record?.exceptionCount ? <Link className="button button--secondary button--md" href={`/timesheets/exceptions?periodId=${encodeURIComponent(periodId)}`}>Ngoại lệ · {record.exceptionCount}</Link> : null}{canAdjust && summary && period.status !== "locked" ? <Link className="button button--primary button--md" href={`/timesheets/adjustments?periodId=${encodeURIComponent(periodId)}&employeeId=${encodeURIComponent(summary.employeeId)}&date=${selectedDay}&rowVersion=${period.rowVersion}`}>Điều chỉnh công</Link> : null}</div>
      </div>
    </Drawer>
  </div>;
}
