"use client";

import { Banknote, CalendarDays, ChevronRight, Pencil, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { PermissionDeniedState } from "@/components/shared/States";
import type { LeaveSettlementOverview as SettlementData, LeaveSettlementRow as SettlementRow, LeaveSettlementStatus as SettlementStatus } from "@/features/leave/types/leaveSettlement";
import { can } from "@/lib/auth/permissions";
import { getBusinessDateKey } from "@/lib/time/timezone";

import styles from "./LeaveYearEndSettlement.module.css";

const labels: Record<SettlementStatus, string> = {
  not_due: "Chưa đến kỳ", missing_rate: "Chưa có đơn giá", invalid_rate: "Đơn giá quá thấp", pending_leave: "Còn đơn chờ duyệt",
  waiting_payroll: "Chờ kỳ lương", waiting_calculation: "Chờ tính lương", payroll_locked: "Kỳ lương đã khóa", included: "Đã vào bảng lương"
};
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const days = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi-VN");
const payrollHref = (row: SettlementRow) => `/accounting/payroll/${row.payrollPeriodId}/employees/${row.employeeId}`;

export function LeaveYearEndSettlement({ initialYear }: { initialYear?: number } = {}) {
  const user = useCurrentUser();
  const canEdit = can(user.permissions, "leave.balance.adjust");
  const canView = can(user.permissions, "leave.balance.view_all");
  const canViewPayroll = can(user.permissions, "payroll.view");
  const [year, setYear] = useState(initialYear ?? Number(getBusinessDateKey().slice(0, 4)));
  const [yearInput, setYearInput] = useState(String(year));
  const [data, setData] = useState<SettlementData>();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SettlementRow | null>(null);
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ rate?: string; reason?: string }>({});
  const requestRef = useRef<AbortController | null>(null);
  const submitLock = useRef(false);
  const modalErrorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/v1/leave-settlements?year=${year}`, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok || !body.ok || !Array.isArray(body.data?.rows)) throw new Error(body.error?.message ?? "Không thể tải tiền phép cuối năm.");
      if (controller.signal.aborted) return;
      const next = body.data as SettlementData;
      setData(next);
      setLeaveTypeId((current) => next.rows.some((row) => row.leaveTypeId === current) ? current : next.rows[0]?.leaveTypeId ?? "");
    } catch (value) {
      if (!controller.signal.aborted) setError(signal.aborted ? "Tải dữ liệu quá lâu. Vui lòng thử lại." : value instanceof Error ? value.message : "Không thể tải tiền phép cuối năm.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [canView, year]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; requestRef.current?.abort(); };
  }, [load]);

  const types = useMemo(() => [...new Map((data?.rows ?? []).map((row) => [row.leaveTypeId, { value: row.leaveTypeId, label: `${row.leaveTypeName}${row.leaveTypeCode ? ` · ${row.leaveTypeCode}` : ""}` }])).values()], [data]);
  const rows = useMemo(() => (data?.rows ?? []).filter((row) => row.leaveTypeId === leaveTypeId && (!query || normalize(`${row.employeeName} ${row.employeeCode}`).includes(normalize(query))) && (!status || row.status === status)).sort((first, second) => first.employeeName.localeCompare(second.employeeName, "vi")), [data, leaveTypeId, query, status]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * 25, currentPage * 25);
  const missingRates = rows.filter((row) => row.dailyRate === null).length;
  const lastRun = data?.lastRunAt ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(data.lastRunAt)) : undefined;

  function openRate(row: SettlementRow) {
    if (!canEdit || row.status === "included") return;
    setEditing(row); setRate(row.dailyRate === null ? "" : String(row.dailyRate)); setReason(""); setSaveError(""); setFieldErrors({});
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || editing.status === "included" || !canEdit || submitLock.current) return;
    const dailyRate = Number(rate);
    const nextErrors: typeof fieldErrors = {};
    if (!rate.trim() || !Number.isInteger(dailyRate) || dailyRate <= 0 || dailyRate > 1_000_000_000) nextErrors.rate = "Đơn giá từ 1 đến 1.000.000.000 đ, không có phần lẻ.";
    if (reason.trim().length < 3) nextErrors.reason = "Lý do cần ít nhất 3 ký tự.";
    setFieldErrors(nextErrors); setSaveError("");
    if (Object.keys(nextErrors).length) { requestAnimationFrame(() => document.getElementById(nextErrors.rate ? "settlement-rate" : "settlement-reason")?.focus()); return; }
    submitLock.current = true; setSaving(true);
    try {
      const response = await fetch("/api/v1/leave-settlements", {
        method: "PUT", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ year, employeeId: editing.employeeId, leaveTypeId: editing.leaveTypeId, dailyRate, expectedVersion: editing.rateVersion, reason: reason.trim() })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể lưu đơn giá.");
      setEditing(null); setNotice("Đã lưu đơn giá tiền phép."); await load();
    } catch (value) {
      setSaveError(value instanceof DOMException && value.name === "TimeoutError" ? "Chưa nhận được kết quả. Tải lại số dư trước khi lưu lại." : value instanceof Error ? value.message : "Không thể lưu đơn giá.");
      requestAnimationFrame(() => modalErrorRef.current?.focus());
    } finally { submitLock.current = false; setSaving(false); }
  }

  if (!canView) return <PermissionDeniedState description="" />;
  return <div className={styles.workspace}>
    <section className={styles.surface}>
      <div className={styles.toolbar} data-ui="filter-controls">
        <label className={styles.search} data-ui="filter-search"><Search aria-hidden="true" size={18} /><span className="sr-only">Tìm nhân viên</span><input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm tên, mã nhân viên" type="search" value={query} /></label>
        <Input label="Năm phép" max={2200} min={2000} onBlur={() => { const value = Number(yearInput); if (Number.isInteger(value) && value >= 2000 && value <= 2200) { setYear(value); setPage(1); setNotice(""); } else setYearInput(String(year)); }} onChange={(event) => setYearInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} type="number" value={yearInput} />
        <Select disabled={loading || !types.length} label="Loại nghỉ" onChange={(event) => { setLeaveTypeId(event.target.value); setPage(1); }} options={types} placeholder="Chọn loại nghỉ" value={leaveTypeId} />
        <Select label="Trạng thái" onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả" }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} value={status} />
        <Button aria-label="Tải lại tiền phép" busy={loading} leftIcon={<RefreshCw aria-hidden="true" size={16} />} onClick={() => void load()}>Tải lại</Button>
      </div>
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
      {loading ? <div aria-live="polite" className={styles.empty}><RefreshCw aria-hidden="true" size={22} />Đang tải tiền phép</div> : error ? <div className={styles.error} role="alert"><span>{error}</span><Button onClick={() => void load()}>Thử lại</Button></div> : !rows.length ? <div className={styles.empty}><CalendarDays aria-hidden="true" size={25} /><span>{query || status ? "Không có nhân viên phù hợp" : "Chưa có dữ liệu tiền phép năm này"}</span>{query || status ? <Button onClick={() => { setQuery(""); setStatus(""); setPage(1); }}>Xóa bộ lọc</Button> : null}</div> : <>
        <div className={styles.summaries}>{[
          { label: "Số dư phép", value: `${days(rows.reduce((sum, row) => sum + row.balanceDays, 0))} ngày` },
          { label: "Ngày thanh toán", value: `${days(rows.reduce((sum, row) => sum + row.days, 0))} ngày` },
          { label: "Tiền phép", value: rows.some((row) => row.dailyRate !== null) ? money(rows.filter((row) => row.dailyRate !== null).reduce((sum, row) => sum + row.amount, 0)) : "—" },
          { label: "Chưa có đơn giá", value: `${missingRates} nhân viên` }
        ].map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>)}</div>
        <div className={styles.tableScroll}><table className={styles.table}><caption className="sr-only">Tiền phép cuối năm {year}</caption><thead><tr>{["Nhân viên", "Số dư", "Ngày thanh toán", "Đơn giá / ngày", "Tiền phép", "Trạng thái", "Thao tác"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr key={`${row.employeeId}-${row.leaveTypeId}`}>
          <th scope="row"><strong>{row.employeeName}</strong><span>{row.employeeCode}</span></th><td>{days(row.balanceDays)}</td><td>{days(row.days)}</td><td>{row.dailyRate === null ? "—" : money(row.dailyRate)}</td><td><b>{row.dailyRate === null ? "—" : money(row.amount)}</b></td><td><span className={styles.status} data-status={row.status}>{labels[row.status]}</span></td><td><div className={styles.rowActions}>{canEdit ? <Button disabled={row.status === "included"} leftIcon={<Pencil aria-hidden="true" size={14} />} onClick={() => openRate(row)} size="sm">Đơn giá</Button> : null}{row.payrollPeriodId && canViewPayroll ? <Link aria-label={`Xem lương của ${row.employeeName}`} className={styles.payrollLink} href={payrollHref(row)}><ChevronRight aria-hidden="true" size={18} /></Link> : null}</div></td>
        </tr>)}</tbody></table></div>
        <div className={styles.mobileList}>{visibleRows.map((row) => <article key={`${row.employeeId}-${row.leaveTypeId}`}><header><div><strong>{row.employeeName}</strong><span>{row.employeeCode}</span></div><span className={styles.status} data-status={row.status}>{labels[row.status]}</span></header><div className={styles.mobileAmount}><Banknote aria-hidden="true" size={19} /><span>Tiền phép</span><strong>{row.dailyRate === null ? "—" : money(row.amount)}</strong></div><dl><div><dt>Số dư</dt><dd>{days(row.balanceDays)} ngày</dd></div><div><dt>Thanh toán</dt><dd>{days(row.days)} ngày</dd></div><div className={styles.mobileRate}><dt>Đơn giá / ngày</dt><dd>{row.dailyRate === null ? "—" : money(row.dailyRate)}</dd></div></dl>{canEdit || row.payrollPeriodId && canViewPayroll ? <footer>{canEdit ? <Button disabled={row.status === "included"} leftIcon={<Pencil aria-hidden="true" size={15} />} onClick={() => openRate(row)}>Đơn giá</Button> : null}{row.payrollPeriodId && canViewPayroll ? <Link className="button button--secondary button--md" href={payrollHref(row)}>Xem bảng lương</Link> : null}</footer> : null}</article>)}</div>
        <footer className={styles.pagination}><span>{rows.length} nhân viên{lastRun ? ` · Lần ghi nhận: ${lastRun}` : ""}</span>{pageCount > 1 ? <div><Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} size="sm">Trước</Button><span>{currentPage} / {pageCount}</span><Button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} size="sm">Sau</Button></div> : null}</footer>
      </>}
    </section>
    <Modal className={styles.rateModal} onClose={() => { if (!saving) setEditing(null); }} open={editing !== null} title="Đơn giá tiền phép">
      {editing ? <form className={styles.rateForm} noValidate onSubmit={saveRate}>
        <div className={styles.rateIdentity}><strong>{editing.employeeName}</strong><span>{editing.employeeCode} · {editing.leaveTypeName} · {year}</span></div>
        <Input disabled={saving} error={fieldErrors.rate} id="settlement-rate" inputMode="numeric" label="Đơn giá một ngày (đ)" max={1_000_000_000} min={1} onChange={(event) => { setRate(event.target.value); setFieldErrors((current) => ({ ...current, rate: undefined })); }} required step={1} type="number" value={rate} />
        <Textarea disabled={saving} error={fieldErrors.reason} id="settlement-reason" label="Lý do" maxLength={500} minLength={3} onChange={(event) => { setReason(event.target.value); setFieldErrors((current) => ({ ...current, reason: undefined })); }} required rows={3} value={reason} />
        {saveError ? <div className={styles.error} ref={modalErrorRef} role="alert" tabIndex={-1}><span>{saveError}</span></div> : null}
        <footer><Button disabled={saving} onClick={() => setEditing(null)}>Hủy</Button><Button busy={saving} type="submit" variant="primary">{saving ? "Đang lưu" : "Lưu đơn giá"}</Button></footer>
      </form> : null}
    </Modal>
  </div>;
}

