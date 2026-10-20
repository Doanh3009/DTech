"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Input, SearchInput, Select } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ErrorState, LoadingState } from "@/components/shared/States";
import type { LeaveRequest, LeaveType } from "../types/leaveTypes";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { formatBusinessDate, getBusinessDateKey } from "@/lib/time/timezone";
import { approverSourceLabels, dayPartLabels, formatLeaveDays, isAwaitingLeave, leaveDateLabel, leaveStatusLabels, monthDates, shiftMonth } from "./leavePresentation";
import styles from "./LeaveMonitoring.module.css";

export function LeaveRequestList({ scope = "self", showCreateAction = true }: { scope?: "self" | "all" | "team" | "approval"; showCreateAction?: boolean }) {
  const today = getBusinessDateKey();
  const management = scope === "all" || scope === "team";
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"calendar" | "list">(management ? "calendar" : "list");
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const dates = useMemo(() => monthDates(month), [month]);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ scope });
      if (management) { query.set("startDate", dates[0]); query.set("endDate", dates[dates.length - 1]); }
      const response = await fetch(`/api/v1/leave-requests?${query}`, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok || !body.ok || !Array.isArray(body.data)) throw new Error(body.error?.message ?? "Không thể tải đơn nghỉ.");
      if (!controller.signal.aborted) setItems(body.data);
    } catch (reason) {
      if (!controller.signal.aborted) setError(signal.aborted ? "Tải đơn nghỉ quá lâu. Vui lòng thử lại." : reason instanceof Error ? reason.message : "Không thể tải đơn nghỉ.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [dates, management, scope]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; requestRef.current?.abort(); };
  }, [load]);
  useEffect(() => {
    if (!management) return;
    const controller = new AbortController();
    void fetch("/api/v1/leave-types", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(response => response.json()).then(body => { if (!controller.signal.aborted && body.ok && Array.isArray(body.data)) setTypes(body.data); })
      .catch(() => { /* Request names remain available if configuration lookup fails. */ });
    return () => controller.abort();
  }, [management]);
  useDomainReconciliation("leave", load);

  const filtered = useMemo(() => items.filter(item => {
    const needle = search.trim().toLocaleLowerCase("vi");
    return (!needle || `${item.employeeName} ${item.employeeCode} ${item.requestNumber}`.toLocaleLowerCase("vi").includes(needle))
      && (!department || item.departmentName === department) && (!typeId || item.leaveTypeId === typeId)
      && (!status || (status === "pending" ? isAwaitingLeave(item) : item.status === status));
  }), [items, search, department, typeId, status]);
  const observed = filtered.filter(item => item.status === "approved" || isAwaitingLeave(item));
  const selectedDay = selectedDate.startsWith(month) ? selectedDate : dates[0];
  const onDay = (date: string) => observed.filter(item => item.startDate <= date && item.endDate >= date && (item.workingDates === undefined || item.workingDates.includes(date)));
  const dayItems = onDay(selectedDay);
  const departments = [...new Set(items.map(item => item.departmentName).filter(value => value && value !== "—"))].sort((a, b) => a.localeCompare(b, "vi"));
  const typeChoices = types.length ? types.filter(type => type.active || items.some(item => item.leaveTypeId === type.id)).map(type => ({ value: type.id, label: `${type.name} · ${type.code}` }))
    : [...new Map(items.map(item => [item.leaveTypeId, { value: item.leaveTypeId, label: item.leaveTypeName }])).values()];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 30) - 1));
  const columns = useMemo<DataTableColumn<LeaveRequest>[]>(() => [
    ...(scope !== "self" ? [{ id: "employee", header: "Nhân viên", priority: "primary" as const, cell: (item: LeaveRequest) => <div className={styles.employee}><strong>{item.employeeName}</strong><span>{item.employeeCode} · {item.departmentName}</span></div> }] : []),
    { id: "type", header: "Loại nghỉ", accessor: "leaveTypeName", priority: scope === "self" ? "primary" : undefined },
    { id: "time", header: "Thời gian nghỉ", cell: leaveDateLabel },
    { id: "days", header: "Ngày", align: "right", width: "compact", cell: item => formatLeaveDays(item.calculatedDays) },
    { id: "status", header: "Trạng thái", cell: item => <StatusBadge status={item.status}>{leaveStatusLabels[item.status]}</StatusBadge> },
    ...(scope !== "self" ? [{ id: "approver", header: "Đang chờ", hiddenOnMobile: true, cell: (item: LeaveRequest) => {
      const step = item.approvalSteps.find(value => value.status === "pending");
      return isAwaitingLeave(item) && step ? <div className={styles.approver}><strong>{step.approverName || "Chưa xác định người duyệt"}</strong><span>Bước {step.stepOrder} · {approverSourceLabels[step.approverSource] || step.approverSource}</span></div> : "—";
    } }] : []),
    { id: "number", header: "Mã đơn", accessor: "requestNumber", hiddenOnMobile: true }
  ], [scope]);
  const href = (item: LeaveRequest) => `${management ? "/leave/manage" : "/leave/requests"}/${item.id}`;
  function changeMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < "2000-01" || value > "2200-12") return;
    setMonth(value); setSelectedDate(value === today.slice(0, 7) ? today : `${value}-01`); setPage(0);
  }

  return <section className={styles.workspace} aria-label={management ? "Theo dõi nghỉ phép nhân viên" : "Danh sách đơn nghỉ"}>
    {management ? <>
      <div className={styles.toolbar}>
        <div className={styles.tabs} aria-label="Chế độ theo dõi">
          <button type="button" aria-pressed={view === "calendar"} onClick={() => { setView("calendar"); setStatus(""); }}>Lịch nghỉ</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>Danh sách đơn</button>
        </div>
        <span className={styles.count}>{loading ? "Đang tải…" : `${(view === "calendar" ? observed : filtered).length} đơn · ${new Set((view === "calendar" ? observed : filtered).map(item => item.employeeId)).size} nhân viên`}</span>
      </div>
      <div className={styles.filters} data-ui="filter-controls">
        <SearchInput aria-label="Tìm nhân viên hoặc mã đơn" placeholder="Nhân viên, mã đơn" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
        <Select label="Phòng ban" value={department} onChange={event => { setDepartment(event.target.value); setPage(0); }} options={[{ value: "", label: "Tất cả" }, ...departments.map(value => ({ value, label: value }))]} />
        <Select label="Loại nghỉ" value={typeId} onChange={event => { setTypeId(event.target.value); setPage(0); }} options={[{ value: "", label: "Tất cả" }, ...typeChoices]} />
        <Select label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }} options={[{ value: "", label: view === "calendar" ? "Đã duyệt & chờ duyệt" : "Tất cả trạng thái" }, { value: "approved", label: "Đã duyệt" }, { value: "pending", label: "Chờ duyệt" }, ...(view === "list" ? ["draft", "rejected", "withdrawn", "cancelled"].map(value => ({ value, label: leaveStatusLabels[value as keyof typeof leaveStatusLabels] })) : [])]} />
      </div>
      <div className={styles.monthbar}>
        <div className={styles.month} data-ui="filter-controls">
          <IconButton label="Tháng trước" disabled={month === "2000-01"} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></IconButton>
          <Input label="Tháng nghỉ" type="month" value={month} min="2000-01" max="2200-12" onChange={event => changeMonth(event.target.value)} />
          <IconButton label="Tháng sau" disabled={month === "2200-12"} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></IconButton>
          <Button onClick={() => changeMonth(today.slice(0, 7))}>Hôm nay</Button>
        </div>
        {view === "calendar" ? <div className={styles.legend}><span><i className={styles.dot} />Đã duyệt</span><span><i className={`${styles.dot} ${styles.pendingDot}`} />Chờ duyệt</span></div> : null}
      </div>
    </> : showCreateAction && scope === "self" ? <div className={styles.toolbar}><Link className="button button--primary button--md" href="/leave/new">Tạo đơn nghỉ</Link></div> : null}
    {error ? <ErrorState title="Không thể tải đơn nghỉ" description={error} action={<Button onClick={() => void load()}>Thử lại</Button>} /> : loading ? <LoadingState title="Đang tải đơn nghỉ" /> : management && view === "calendar" ? <div className={styles.calendarLayout}>
      <div className={styles.calendar}>
        <div className={styles.weekdays} aria-hidden="true">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.dates}>
          {Array.from({ length: (new Date(`${dates[0]}T00:00:00Z`).getUTCDay() + 6) % 7 }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
          {dates.map(date => {
            const entries = onDay(date);
            const approved = new Set(entries.filter(item => item.status === "approved").map(item => item.employeeId)).size;
            const pending = new Set(entries.filter(isAwaitingLeave).map(item => item.employeeId)).size;
            return <button className={styles.date} key={date} type="button" aria-pressed={selectedDay === date} data-today={date === today || undefined} aria-label={`${formatBusinessDate(date)}, ${approved} nhân viên nghỉ đã duyệt, ${pending} chờ duyệt`} onClick={() => setSelectedDate(date)}>
              <strong>{Number(date.slice(-2))}</strong>{approved ? <span className={styles.dateCount}>{approved} nghỉ</span> : null}{pending ? <span className={`${styles.dateCount} ${styles.pendingCount}`}>{pending} chờ</span> : null}
            </button>;
          })}
        </div>
      </div>
      <section className={styles.dayList} aria-label={`Nghỉ ngày ${formatBusinessDate(selectedDay)}`}>
        <header className={styles.dayHeading}><h3>{formatBusinessDate(selectedDay)}</h3><span>{new Set(dayItems.map(item => item.employeeId)).size} nhân viên</span></header>
        {dayItems.length ? dayItems.map(item => <Link className={styles.record} href={href(item)} key={item.id}>
          <span className={styles.avatar} aria-hidden="true">{item.employeeName.trim().split(/\s+/).slice(-2).map(word => word[0]).join("")}</span>
          <div className={styles.recordBody}><div className={styles.recordHeading}><strong>{item.employeeName}</strong><StatusBadge status={item.status}>{leaveStatusLabels[item.status]}</StatusBadge></div><span>{item.employeeCode} · {item.departmentName}</span><span>{item.leaveTypeName} · {dayPartLabels[selectedDay === item.startDate ? item.startDayPart : selectedDay === item.endDate ? item.endDayPart : "full_day"]}</span><span>{leaveDateLabel(item)} · {formatLeaveDays(item.calculatedDays)} ngày</span></div>
        </Link>) : <div className={styles.empty}>Không có đơn nghỉ cho ngày này</div>}
      </section>
    </div> : <>
      <DataTable ariaLabel={scope === "approval" ? "Đơn nghỉ chờ tôi duyệt" : "Danh sách đơn nghỉ"} columns={columns} data={filtered.slice(currentPage * 30, currentPage * 30 + 30)} emptyDescription="" emptyTitle={scope === "approval" ? "Không có đơn chờ duyệt" : "Không có đơn nghỉ"} getRowId={item => item.id} getRowHref={href} actions={item => <Link className="button button--secondary button--sm" href={href(item)}>Chi tiết</Link>} />
      {filtered.length > 30 ? <div className={styles.pagination}><span>{currentPage * 30 + 1}–{Math.min((currentPage + 1) * 30, filtered.length)} / {filtered.length} đơn</span><Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Trước</Button><Button disabled={(currentPage + 1) * 30 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Tiếp</Button></div> : null}
    </>}
  </section>;
}
