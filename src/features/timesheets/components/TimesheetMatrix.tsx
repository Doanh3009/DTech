"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { SearchInput, Select } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBusinessDate, getBusinessDateKey } from "@/lib/time/timezone";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import type { DailyTimesheet, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";
import { defaultPeriod, reconcileTimesheet } from "../services/timesheetPresentation";
import styles from "./TimesheetMatrix.module.css";

type Detail = { period: TimesheetPeriod; summaries: TimesheetSummary[]; daily: DailyTimesheet[] };
const periodLabels = { open: "Mở", reviewing: "Đang rà soát", locked: "Đã chốt", reopened: "Đã mở lại" };
const employeePath = (periodId: string, item: TimesheetSummary) => `/timesheets/periods/${encodeURIComponent(periodId)}/employees/${encodeURIComponent(item.employeeCode || item.employeeId)}`;
const count = (value: number) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "—";

export function TimesheetMatrix({ initialPeriodId }: { canAdjust?: boolean; initialPeriodId?: string }) {
  const [periods, setPeriods] = useState<TimesheetPeriod[]>([]), [periodId, setPeriodId] = useState("");
  const activePeriodRef = useRef(periodId);
  const [detail, setDetail] = useState<Detail>(), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(""), [department, setDepartment] = useState(""), [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/timesheet-periods", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải kỳ công.");
      const items: TimesheetPeriod[] = body.data ?? [];
      setPeriods(items);
      const chosen = items.some(item => item.id === initialPeriodId) ? initialPeriodId! : defaultPeriod(items, getBusinessDateKey());
      activePeriodRef.current = chosen;
      setPeriodId(chosen);
      if (!items.length) setLoading(false);
    }).catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setLoading(false); } });
    return () => controller.abort();
  }, [initialPeriodId]);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!periodId) return;
    const response = await fetch(`/api/v1/timesheet-periods/${periodId}`, { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
    const body = await response.json();
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải bảng công.");
    if (activePeriodRef.current !== periodId) return;
    setDetail(body.data); setError(""); setLoading(false);
  }, [periodId]);
  useEffect(() => {
    if (!periodId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { setLoading(true); void load(controller.signal).catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setLoading(false); } }); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, periodId]);
  useDomainReconciliation("timesheets", load);
  const period = detail?.period.id === periodId ? detail.period : periods.find(item => item.id === periodId);
  const summaries = detail?.period.id === periodId ? detail.summaries : [];
  const daily = useMemo(() => detail?.period.id === periodId ? detail.daily : [], [detail, periodId]);
  const byEmployee = useMemo(() => {
    const result = new Map<string, DailyTimesheet[]>();
    for (const item of daily) { const rows = result.get(item.employeeId) ?? []; rows.push(item); result.set(item.employeeId, rows); }
    return result;
  }, [daily]);
  const issues = new Set(summaries.filter(item => item.exceptionCount > 0 || reconcileTimesheet(item, byEmployee.get(item.employeeId) ?? []).mismatch).map(item => item.employeeId));
  const filtered = summaries.filter(item => (!department || item.departmentName === department) && (!onlyIssues || issues.has(item.employeeId)) && `${item.employeeName} ${item.employeeCode}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const pageCount = Math.ceil(filtered.length / 20), currentPage = Math.min(page, Math.max(0, pageCount - 1)), visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  const missingDaily = summaries.filter(item => !(byEmployee.get(item.employeeId)?.length) && item.actualWorkdays > 0).length;
  function changePeriod(id: string) { activePeriodRef.current = id; setPeriodId(id); setPage(0); }
  return <div className={styles.workspace}>
    <Card className={styles.controls}>
      <div className={styles.heading}><div><h2>Bảng công nhân viên</h2>{period ? <div className={styles.periodMeta}><span>{formatBusinessDate(period.startDate)} – {formatBusinessDate(period.endDate)}</span><StatusBadge tone={period.status === "locked" ? "success" : "warning"}>{periodLabels[period.status]}</StatusBadge></div> : null}</div><div className={styles.periodSelect} data-ui="filter-controls"><Select label="Kỳ công" labelHidden onChange={event => changePeriod(event.target.value)} options={periods.map(item => ({ label: item.name, value: item.id }))} value={periodId} /><Button aria-label="Cập nhật bảng công" disabled={loading} onClick={() => void load().catch(reason => setError(reason.message))}><RefreshCw aria-hidden="true" size={16}/></Button>{period ? <Link aria-label="Quản lý kỳ công" className="button button--secondary button--md" href={`/timesheets/periods/${period.id}`}><ArrowUpRight aria-hidden="true" size={17}/></Link> : null}</div></div>
      <div className={styles.toolbar} data-ui="filter-controls"><div className={styles.search}><SearchInput aria-label="Tìm nhân viên" placeholder="Tên hoặc mã nhân viên" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></div><Select label="Phòng ban" labelHidden options={[{ value: "", label: "Tất cả phòng ban" }, ...[...new Set(summaries.map(item => item.departmentName).filter(Boolean))].map(name => ({ value: name, label: name }))]} value={department} onChange={event => { setDepartment(event.target.value); setPage(0); }} /><Button aria-pressed={onlyIssues} variant={onlyIssues ? "primary" : "secondary"} onClick={() => { setOnlyIssues(value => !value); setPage(0); }}>Cần rà soát · {issues.size}</Button></div>
    </Card>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {!loading && period ? <>
      <dl aria-label="Tổng hợp kỳ công" className={styles.metrics}><div><dt>Nhân viên</dt><dd>{summaries.length}</dd></div><div><dt>Ngày công</dt><dd>{count(summaries.reduce((sum, item) => sum + item.actualWorkdays, 0))}</dd></div><div><dt>Nghỉ phép</dt><dd>{count(summaries.reduce((sum, item) => sum + (item.annualLeaveDays || 0), 0))}</dd></div><div><dt>Cần rà soát</dt><dd>{issues.size}</dd></div></dl>
      {missingDaily ? <div className={styles.dataAlert} role="status"><span>{missingDaily} hồ sơ thiếu dữ liệu từng ngày</span><Link href={`/timesheets/periods/${period.id}`}>Đối chiếu kỳ công</Link></div> : null}
      <Card className={styles.listSurface} padding="none">
        <div className={styles.listHeading}><strong>Danh sách nhân viên</strong><span>{filtered.length} nhân viên</span></div>
        {visible.length ? <table aria-label="Bảng công tổng hợp nhân viên" className={styles.table} role="table"><thead><tr role="row"><th scope="col">Nhân viên</th><th scope="col">Ngày công</th><th scope="col">Đi trễ</th><th scope="col">Nghỉ phép</th><th scope="col">Không lương</th><th scope="col">Vắng</th><th scope="col">Trạng thái</th></tr></thead><tbody>{visible.map(item => <tr key={item.employeeId} role="row"><th scope="row" className={styles.employee}><Link className={styles.employeeLink} href={employeePath(period.id, item)}><span><strong>{item.employeeName}</strong><small>{item.employeeCode}{item.departmentName ? ` · ${item.departmentName}` : ""}</small></span><ChevronRight aria-hidden="true" size={16}/></Link></th><td className={styles.workdays} data-label="Ngày công" role="cell">{count(item.actualWorkdays)}</td><td data-label="Đi trễ" role="cell">{count(item.lateDays)}</td><td data-label="Nghỉ phép" role="cell">{count(item.annualLeaveDays)}</td><td data-label="Không lương" role="cell">{count(item.unpaidLeaveDays)}</td><td data-label="Vắng" role="cell">{count(item.absentDays)}</td><td className={styles.review} data-label="Trạng thái" role="cell"><StatusBadge tone={issues.has(item.employeeId) ? "warning" : period.status === "locked" ? "success" : "neutral"}>{issues.has(item.employeeId) ? "Cần rà soát" : period.status === "locked" ? "Đã chốt" : "Đã tổng hợp"}</StatusBadge></td></tr>)}</tbody></table> : <div className={styles.noData}>Không có nhân viên phù hợp</div>}
        {pageCount > 1 ? <div className={styles.pagination}><span>{currentPage * 20 + 1}–{Math.min(filtered.length, (currentPage + 1) * 20)} / {filtered.length}</span><Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Trước</Button><Button disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Tiếp</Button></div> : null}
      </Card>
    </> : loading ? <Card><p role="status">Đang tải bảng công…</p></Card> : <Card>Chưa có kỳ công</Card>}
  </div>;
}
