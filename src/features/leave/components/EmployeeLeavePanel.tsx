"use client";

import { CalendarDays, History, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Input, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { LeaveAdjustmentForm } from "@/features/leave/components/LeaveAdjustmentForm";
import type { LeaveBalance, LeaveLedgerEntry, LeaveRequest, LeaveType } from "@/features/leave/types/leaveTypes";
import { can } from "@/lib/auth/permissions";
import { getBusinessDateKey } from "@/lib/time/timezone";

import styles from "./LeaveBalances.module.css";

export const formatLeaveDays = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
export function formatLeaveDate(value: string) {
  const date = value.slice(0, 10).split("-");
  return date.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : value;
}

export async function readLeaveData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể tải dữ liệu nghỉ phép.");
  return body.data as T;
}

const ledgerLabels: Record<LeaveLedgerEntry["transactionType"], string> = {
  grant: "Cấp phép", carryover: "Chuyển phép", adjustment_add: "Điều chỉnh tăng",
  adjustment_subtract: "Điều chỉnh giảm", leave_usage: "Sử dụng phép", leave_reversal: "Hoàn phép", expiry: "Hết hạn phép"
};
const requestLabels: Record<LeaveRequest["status"], string> = {
  draft: "Nháp", submitted: "Đã gửi", pending_approval: "Chờ duyệt", approved: "Đã duyệt",
  rejected: "Từ chối", withdrawn: "Đã rút", cancelled: "Đã hủy"
};

export function LeaveBalanceBreakdown({ balance }: { balance: LeaveBalance }) {
  const items = [
    ["Đã cấp", balance.granted], ["Chuyển năm", balance.carryover], ["Điều chỉnh", balance.adjustments],
    ["Đã dùng", balance.used], ["Chờ duyệt", balance.pending], ["Còn lại", balance.officialRemaining]
  ] as const;
  return <section aria-label={`Số dư ${balance.leaveTypeName}`} className={styles.breakdown}>
    <div className={styles.available} data-negative={balance.availableAfterPending < 0 || undefined}>
      <span>Khả dụng</span><strong>{formatLeaveDays(balance.availableAfterPending)}<small> ngày</small></strong>
    </div>
    <dl className={styles.balanceMetrics}>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatLeaveDays(value)}</dd></div>)}</dl>
  </section>;
}

export function LeaveLedgerList({ ledger, management = false }: { ledger: LeaveLedgerEntry[]; management?: boolean }) {
  if (!ledger.length) return <div className={styles.empty}><History aria-hidden="true" size={24} /><span>Chưa có biến động phép</span></div>;
  return <ol className={styles.ledger}>{ledger.map((entry) => {
    const requestReference = entry.referenceType === "leave_request" && /^[0-9a-f-]{36}$/i.test(entry.referenceId);
    return <li key={entry.id}>
      <span aria-hidden="true" className={styles.ledgerMark} data-decrease={entry.amount < 0 || undefined}>{entry.amount < 0 ? "−" : "+"}</span>
      <div className={styles.ledgerContent}><div className={styles.ledgerHeading}><strong>{entry.referenceType === "leave_year_end_cashout" ? "Thanh toán phép dư" : ledgerLabels[entry.transactionType]}</strong><b data-decrease={entry.amount < 0 || undefined}>{entry.amount > 0 ? "+" : ""}{formatLeaveDays(entry.amount)} ngày</b></div>
        <span>{entry.leaveTypeName} · {formatLeaveDate(entry.effectiveDate)}</span>
        {entry.reason ? <p>{entry.reason}</p> : null}
        {requestReference ? <Link className={styles.reference} href={`/leave/${management ? "manage" : "requests"}/${entry.referenceId}`}>Xem đơn nghỉ</Link> : null}
      </div>
    </li>;
  })}</ol>;
}

interface EmployeeLeavePanelProps {
  employeeId: string;
  initialYear?: number;
  initialLeaveTypeId?: string;
  onBalanceChange?: () => void;
}

export function EmployeeLeavePanel({ employeeId, initialYear, initialLeaveTypeId = "", onBalanceChange }: EmployeeLeavePanelProps) {
  const user = useCurrentUser();
  const canAdjust = can(user.permissions, "leave.balance.adjust");
  const canViewRequests = can(user.permissions, "leave.view_all") || can(user.permissions, "leave.approve_all");
  const [year, setYear] = useState(initialYear ?? Number(getBusinessDateKey().slice(0, 4)));
  const [yearInput, setYearInput] = useState(String(year));
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [ledger, setLedger] = useState<LeaveLedgerEntry[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState(initialLeaveTypeId);
  const [tab, setTab] = useState<"ledger" | "requests">("ledger");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [editMode, setEditMode] = useState<"grant" | "adjust" | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    const read = <T,>(path: string) => readLeaveData<T>(path, controller.signal);
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); setRequestError(""); setRequests([]); setRequestsLoading(canViewRequests); } });
    void Promise.all([
      read<LeaveBalance[]>(`/api/v1/employees/${employeeId}/leave-balance?year=${year}`),
      read<LeaveLedgerEntry[]>(`/api/v1/employees/${employeeId}/leave-ledger?year=${year}`),
      read<LeaveType[]>("/api/v1/leave-types")
    ]).then(([nextBalances, nextLedger, nextTypes]) => {
      if (!active) return;
      setBalances(nextBalances); setLedger(nextLedger); setTypes(nextTypes.filter((type) => (type.active && type.deductsBalance) || nextBalances.some((item) => item.leaveTypeId === type.id)));
      setLeaveTypeId((current) => nextBalances.some((item) => item.leaveTypeId === current) ? current : nextBalances[0]?.leaveTypeId ?? "");
    }).catch((value: Error) => {
      if (active) setError(controller.signal.aborted ? "Tải dữ liệu quá lâu. Vui lòng thử lại." : value.message);
    }).finally(() => { if (active) setLoading(false); });
    if (canViewRequests) void read<LeaveRequest[]>(`/api/v1/leave-requests?scope=all&employeeId=${employeeId}&startDate=${year}-01-01&endDate=${year}-12-31`)
      .then((items) => { if (active) setRequests(items.filter((item) => item.employeeId === employeeId && item.endDate >= `${year}-01-01` && item.startDate <= `${year}-12-31`)); })
      .catch((value: Error) => { if (active) setRequestError(controller.signal.aborted ? "Không thể tải đơn nghỉ. Vui lòng thử lại." : value.message); })
      .finally(() => { if (active) setRequestsLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [canViewRequests, employeeId, reload, year]);

  const selected = balances.find((item) => item.leaveTypeId === leaveTypeId);
  const canManageSelectedType = types.some((type) => type.id === leaveTypeId && type.active && type.deductsBalance);
  const filteredLedger = useMemo(() => ledger.filter((item) => item.leaveTypeId === leaveTypeId), [leaveTypeId, ledger]);
  const filteredRequests = useMemo(() => requests.filter((item) => item.leaveTypeId === leaveTypeId), [leaveTypeId, requests]);
  const employee = balances[0];

  return <div className={styles.panel}>
    <div className={styles.panelToolbar}>
      {employee ? <div className={styles.identity}><strong>{employee.employeeName}</strong><span>{employee.employeeCode} · {employee.departmentName}</span></div> : null}
      <Input label="Năm" max={2200} min={2000} onBlur={() => { const value = Number(yearInput); if (Number.isInteger(value) && value >= 2000 && value <= 2200) setYear(value); else setYearInput(String(year)); }} onChange={(event) => setYearInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} type="number" value={yearInput} />
    </div>
    {loading ? <div aria-live="polite" className={styles.loading}><RefreshCw aria-hidden="true" size={20} /><span>Đang tải số dư phép</span></div> : error ? <div className={styles.error} role="alert"><span>{error}</span><Button onClick={() => setReload((value) => value + 1)}>Thử lại</Button></div> : !balances.length ? <div className={styles.empty}><CalendarDays aria-hidden="true" size={24} /><span>Chưa có loại nghỉ theo dõi số dư</span></div> : <>
      <Select label="Loại nghỉ" onChange={(event) => setLeaveTypeId(event.target.value)} options={balances.map((item) => { const type = types.find((definition) => definition.id === item.leaveTypeId); return { value: item.leaveTypeId, label: `${item.leaveTypeName}${type?.code ? ` · ${type.code}` : ""}${type && !type.active ? " · Ngừng dùng" : ""}` }; })} value={leaveTypeId} />
      {selected ? <LeaveBalanceBreakdown balance={selected} /> : null}
      {canAdjust ? <div className={styles.actions}><Button disabled={!canManageSelectedType} onClick={() => setEditMode("grant")} variant="soft">Cấp phép</Button><Button disabled={!canManageSelectedType} onClick={() => setEditMode("adjust")}>Điều chỉnh</Button></div> : null}
      <nav aria-label="Chi tiết phép" className={styles.tabs}>
        <button aria-pressed={tab === "ledger"} onClick={() => setTab("ledger")} type="button"><History aria-hidden="true" size={17} />Biến động phép<span>{filteredLedger.length}</span></button>
        {canViewRequests ? <button aria-pressed={tab === "requests"} onClick={() => setTab("requests")} type="button"><CalendarDays aria-hidden="true" size={17} />Đơn nghỉ<span>{filteredRequests.length}</span></button> : null}
      </nav>
      {tab === "ledger" || !canViewRequests ? <LeaveLedgerList ledger={filteredLedger} management /> : requestsLoading ? <div aria-live="polite" className={styles.loading}>Đang tải đơn nghỉ</div> : requestError ? <div className={styles.error} role="alert"><span>{requestError}</span><Button onClick={() => setReload((value) => value + 1)}>Thử lại</Button></div> : !filteredRequests.length ? <div className={styles.empty}><CalendarDays aria-hidden="true" size={24} /><span>Chưa có đơn nghỉ trong năm {year}</span></div> : <ul className={styles.requests}>{filteredRequests.map((request) => <li key={request.id}>
        <Link href={`/leave/manage/${request.id}`}><strong>{request.requestNumber}</strong><span>{formatLeaveDate(request.startDate)}{request.endDate !== request.startDate ? ` – ${formatLeaveDate(request.endDate)}` : ""}{request.startDate === request.endDate && request.startDayPart !== "full_day" ? ` · ${request.startDayPart === "morning" ? "Buổi sáng" : "Buổi chiều"}` : ""}</span></Link>
        <div><b>{formatLeaveDays(request.calculatedDays)} ngày</b><span className={styles.status} data-status={request.status}>{requestLabels[request.status]}</span></div>
      </li>)}</ul>}
    </>}
    <Drawer className={styles.adjustmentDrawer} onClose={() => setEditMode(null)} open={editMode !== null} title={editMode === "grant" ? "Cấp phép nhân viên" : "Điều chỉnh phép"}>
      {editMode ? <LeaveAdjustmentForm initialEmployeeId={employeeId} initialLeaveTypeId={leaveTypeId} initialYear={year} mode={editMode} onSaved={() => { setEditMode(null); setReload((value) => value + 1); onBalanceChange?.(); }} /> : null}
    </Drawer>
  </div>;
}
