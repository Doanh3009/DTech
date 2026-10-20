"use client";

import { AlertTriangle, CalendarDays, CalendarOff, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, ImageIcon, LogIn, LogOut } from "lucide-react";
import { AttendanceLocationAddress } from "./AttendanceLocationAddress";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Drawer } from "@/components/shared/Overlays";
import type { AttendanceHistoryDay } from "@/features/attendance/types/attendanceTypes";
import { formatBusinessDate, getBusinessDateKey } from "@/lib/time/timezone";
import { useIsPhone } from "@/lib/ui/useIsPhone";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import styles from "./AttendanceHistory.module.css";
import detailStyles from "./AttendanceDetail.module.css";

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const statusMeta = {
  complete: { label: "Đủ công", tone: "success" as const },
  checked_in: { label: "Đã chấm vào", tone: "success" as const },
  missing_check_out: { label: "Thiếu công", tone: "error" as const },
  late: { label: "Đi muộn", tone: "warning" as const },
  pending: { label: "Chờ đồng bộ", tone: "info" as const },
  leave: { label: "Nghỉ phép", tone: "info" as const },
  business_trip: { label: "Công tác", tone: "info" as const },
  holiday: { label: "Ngày lễ", tone: "warning" as const },
  rest_day: { label: "Ngày nghỉ", tone: "neutral" as const }
};
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const time = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";

export function AttendanceHistory({ selectedDate }: { selectedDate?: string }) {
  const [month, setMonth] = useState(() => new Date(`${selectedDate ?? getBusinessDateKey()}T12:00:00`));
  const [days, setDays] = useState<AttendanceHistoryDay[]>();
  const [loading, setLoading] = useState(true);
  useLoadingActivity(loading);
  const [error, setError] = useState("");
  const [activeDate, setActiveDate] = useState<string>();
  const mobile = useIsPhone();
  const today = getBusinessDateKey();
  const range = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const leading = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - leading);
    const cellCount = Math.ceil((leading + last.getDate()) / 7) * 7;
    return { first, last, cells: Array.from({ length: cellCount }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; }) };
  }, [month]);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    const params = new URLSearchParams({ from: dateKey(range.first), to: dateKey(range.last) });
    void fetch(`/api/v1/attendance/history?${params}`, { cache: "no-store", signal }).then(async (response) => {
      const body = await response.json() as { data?: AttendanceHistoryDay[]; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải lịch công.");
      if (controller.signal.aborted) return;
      setDays(body.data);
      setLoading(false);
      setError("");
    }).catch((reason: unknown) => { if (!controller.signal.aborted) { setError(signal.aborted ? "Tải lịch công quá lâu. Vui lòng mở lại." : reason instanceof Error ? reason.message : "Không thể tải lịch công."); setLoading(false); } });
    return () => controller.abort();
  }, [range.first, range.last]);
  useEffect(() => {
    if (!activeDate) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveDate(undefined); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [activeDate]);

  if (!days && !error) return <LoadingState />;
  if (!days) return <ErrorState description={error} />;
  const monthDays = days.filter((day) => day.date >= dateKey(range.first) && day.date <= dateKey(range.last));
  const byDate = new Map((loading ? [] : monthDays).map((day) => [day.date, day]));
  if (selectedDate) {
    const selected = byDate.get(selectedDate);
    return selected ? <AttendanceDayDetail day={selected} /> : <ErrorState title="Không có dữ liệu" description="Ngày này chưa có dữ liệu công." />;
  }
  const selectedDayKey = activeDate ?? (today >= dateKey(range.first) && today <= dateKey(range.last) ? today : dateKey(range.first));
  const selected = byDate.get(selectedDayKey);
  const monthStats = [
    { status: "complete", label: "Đủ công", icon: Check }, { status: "late", label: "Đi muộn", icon: Clock3 },
    { status: "missing_check_out", label: "Thiếu công", icon: AlertTriangle }, { status: "leave", label: "Nghỉ phép", icon: CalendarOff }
  ];
  function changeMonth(next: Date) {
    setLoading(true);
    setError("");
    setActiveDate(undefined);
    setMonth(next);
  }

  return <div className={`attendance-page ${styles.page}`}><Card className={`attendance-calendar ${styles.calendar}`}>
    <header className={styles.header}><div className={styles.heading}><span aria-hidden="true" className={styles.headingIcon}><CalendarDays size={22} /></span><div><h2>Lịch công của tôi</h2><span>Tháng {String(month.getMonth() + 1).padStart(2, "0")}/{month.getFullYear()}</span></div></div><div className={styles.controls}>
      <Button aria-label="Tháng trước" disabled={loading} onClick={() => changeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} size="sm" variant="ghost"><ChevronLeft size={17} /></Button>
      <Button disabled={loading} onClick={() => changeMonth(new Date(`${today}T12:00:00`))} size="sm" variant="secondary">Hôm nay</Button>
      <Button aria-label="Tháng sau" disabled={loading} onClick={() => changeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} size="sm" variant="ghost"><ChevronRight size={17} /></Button>
    </div></header>
    <dl className={`attendance-calendar__stats ${styles.stats}`}>{monthStats.map((stat) => <div className={`is-${stat.status}`} key={stat.status}><span aria-hidden="true" className={styles.statIcon}><stat.icon size={18} /></span><dd>{loading ? "—" : monthDays.filter((day) => day.status === stat.status).length}</dd><dt>{stat.label}</dt></div>)}</dl>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {loading ? <span className="sr-only" role="status">Đang tải lịch công</span> : null}
    <div className={`attendance-calendar__weekdays ${styles.weekdays}`}>{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
    <div className={`attendance-calendar__grid ${styles.grid}`}>{range.cells.map((date) => {
      const key = dateKey(date);
      const day = byDate.get(key);
      const outside = date.getMonth() !== month.getMonth();
      const meta = day ? statusMeta[day.status] : undefined;
      return <button aria-current={key === today ? "date" : undefined} aria-label={`${formatBusinessDate(key)}${meta ? `, ${meta.label}` : ", chưa có lượt chấm"}`} aria-pressed={mobile ? selectedDayKey === key : activeDate === key} className={`${styles.day} ${outside ? "is-outside " : ""}${day ? `is-${day.status}` : "is-empty"}`} disabled={outside || loading} key={key} onClick={() => setActiveDate(key)} type="button"><span>{date.getDate()}</span>{meta ? <><strong>{meta.label}</strong>{day?.checkIn || day?.checkOut ? <small>{time(day.checkIn?.effectiveAt)} – {time(day.checkOut?.effectiveAt)}</small> : null}</> : null}</button>;
    })}</div>
    <details className={`attendance-calendar__legend ${styles.legend}`} open={!mobile}><summary><span>Chú thích</span><ChevronDown aria-hidden="true" size={16} /></summary><footer>{Object.entries(statusMeta).map(([status, meta]) => <span className={`is-${status}`} key={status}>{meta.label}</span>)}</footer></details>
  </Card>
    {mobile ? <section aria-labelledby="attendance-selected-date" className={`attendance-calendar__selected ${styles.selected}`}><h3 id="attendance-selected-date">Ngày {formatBusinessDate(selectedDayKey)}</h3>{loading ? <div aria-busy="true" className="attendance-calendar__detail-skeleton"><span /><span /></div> : selected ? <AttendanceDayDetail day={selected} showHeading={false} /> : <AttendanceEmptyDay />}</section> : null}
    <Drawer className={`attendance-day-drawer ${detailStyles.drawer}`} onClose={() => setActiveDate(undefined)} open={Boolean(activeDate) && !mobile} title={activeDate ? `Chi tiết công ${formatBusinessDate(activeDate)}` : "Chi tiết công"}>
      {selected ? <AttendanceDayDetail day={selected} showHeading={false} /> : <AttendanceEmptyDay />}
    </Drawer>
  </div>;
}

function AttendanceEmptyDay() {
  return <div className={`attendance-day-detail ${detailStyles.dayDetail}`}><div className={detailStyles.empty}><CalendarDays aria-hidden="true" size={24} /><p>Chưa có lượt chấm công.</p></div><dl className={`attendance-day-summary ${detailStyles.summary}`}><div><dt>Giờ vào</dt><dd>—</dd></div><div><dt>Giờ ra</dt><dd>—</dd></div></dl></div>;
}

function AttendanceDayDetail({ day, showHeading = true }: { day: AttendanceHistoryDay; showHeading?: boolean }) {
  const minutes = day.checkIn && day.checkOut ? Math.max(0, Math.round((new Date(day.checkOut.effectiveAt).getTime() - new Date(day.checkIn.effectiveAt).getTime()) / 60000)) : 0;
  return <div className={`attendance-day-detail ${detailStyles.dayDetail}`}>
    {showHeading ? <h3>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${day.date}T12:00:00+07:00`))}</h3> : null}
    <StatusBadge tone={statusMeta[day.status].tone}>{statusMeta[day.status].label}</StatusBadge>
    <dl className={`attendance-day-summary ${detailStyles.summary}`}><div className={detailStyles.shift}><dt>Ca làm</dt><dd>{day.shiftName ?? "—"} · {day.shiftStart ?? "—"} – {day.shiftEnd ?? "—"}</dd></div><div><dt>Giờ vào</dt><dd>{time(day.checkIn?.effectiveAt)}</dd></div><div><dt>Giờ ra</dt><dd>{time(day.checkOut?.effectiveAt)}</dd></div><div className={detailStyles.duration}><dt>Tổng thời gian</dt><dd>{minutes ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : "—"}</dd></div></dl>
    {[day.checkIn, day.checkOut].map((event, index) => event ? <Card className={detailStyles.eventCard} key={event.id}><div className={`attendance-detail-heading ${detailStyles.eventHeading}`}><span><span aria-hidden="true" className={detailStyles.eventIcon}>{event.eventType === "check_in" ? <LogIn size={18} /> : <LogOut size={18} />}</span>{event.eventType === "check_in" ? "Chấm vào" : "Chấm ra"}</span><strong>{time(event.effectiveAt)}</strong></div><div className={`attendance-detail-grid ${detailStyles.eventFacts}`}><AttendanceLocationAddress accuracyMeters={event.accuracyMeters} latitude={event.latitude} longitude={event.longitude} referenceName={event.locationName} /><span><ImageIcon aria-hidden="true" size={16} />{event.photoId ? <Link href={`/attendance/photos/${event.photoId}`}>Xem ảnh</Link> : "Chưa có ảnh"}</span></div></Card> : day.status === "missing_check_out" && index === 1 ? <div className={`attendance-missing ${detailStyles.missing}`} key="missing"><AlertTriangle aria-hidden="true" size={17} />Thiếu lượt chấm ra</div> : null)}
    {day.status === "missing_check_out" ? <Link className="button button--primary" href={`/attendance/requests?date=${day.date}`}>Gửi yêu cầu điều chỉnh</Link> : null}
  </div>;
}
