"use client";

import { CalendarDays, ChevronRight, History, RefreshCw, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Input, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { EmployeeLeavePanel, formatLeaveDays, LeaveBalanceBreakdown, LeaveLedgerList, readLeaveData } from "@/features/leave/components/EmployeeLeavePanel";
import { LeaveAdjustmentForm } from "@/features/leave/components/LeaveAdjustmentForm";
import type { LeaveBalance, LeaveLedgerEntry, LeaveType } from "@/features/leave/types/leaveTypes";
import { can } from "@/lib/auth/permissions";
import { getBusinessDateKey } from "@/lib/time/timezone";

import styles from "./LeaveBalances.module.css";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi-VN");

export function LeaveBalanceView({ all = false }: { all?: boolean }) {
  const user = useCurrentUser();
  const canAdjust = all && can(user.permissions, "leave.balance.adjust");
  const canViewSettlement = all && (can(user.permissions, "leave.balance.view_all") || can(user.permissions, "leave.balance.adjust"));
  const [year, setYear] = useState(Number(getBusinessDateKey().slice(0, 4)));
  const [yearInput, setYearInput] = useState(String(year));
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [ledger, setLedger] = useState<LeaveLedgerEntry[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState<LeaveBalance | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    void Promise.all([
      readLeaveData<LeaveBalance[] | { balances: LeaveBalance[]; ledger: LeaveLedgerEntry[] }>(`/api/v1/leave-balances?year=${year}${all ? "&scope=all" : ""}`, controller.signal),
      readLeaveData<LeaveType[]>("/api/v1/leave-types", controller.signal)
    ]).then(([data, definitions]) => {
      if (!active) return;
      const items = Array.isArray(data) ? data : data.balances;
      const balanceTypes = definitions.filter((type) => (type.active && type.deductsBalance) || items.some((item) => item.leaveTypeId === type.id));
      setBalances(items);
      setLedger(Array.isArray(data) ? [] : data.ledger);
      setTypes(balanceTypes);
      const activity = new Map<string, number>();
      for (const item of items) activity.set(item.leaveTypeId, (activity.get(item.leaveTypeId) ?? 0) + Math.abs(item.granted) + Math.abs(item.carryover) + Math.abs(item.adjustments) + item.used + item.pending);
      const preferred = [...balanceTypes].sort((first, second) => (activity.get(second.id) ?? 0) - (activity.get(first.id) ?? 0))[0];
      setLeaveTypeId((current) => balanceTypes.some((type) => type.id === current) ? current : preferred?.id ?? "");
    }).catch((value: Error) => {
      if (active) setError(controller.signal.aborted ? "Tải dữ liệu quá lâu. Vui lòng thử lại." : value.message);
    }).finally(() => { if (active) setLoading(false); clearTimeout(timeout); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [all, reload, year]);

  const departments = useMemo(() => [...new Set(balances.map((item) => item.departmentName))].sort((a, b) => a.localeCompare(b, "vi")), [balances]);
  const rows = useMemo(() => balances.filter((item) => item.leaveTypeId === leaveTypeId && (!department || item.departmentName === department) && (!query || normalize(`${item.employeeName} ${item.employeeCode}`).includes(normalize(query)))).sort((a, b) => a.employeeName.localeCompare(b.employeeName, "vi")), [balances, department, leaveTypeId, query]);
  const selected = rows[0];
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * 25, currentPage * 25);
  const summaries = [
    { label: "Nhân viên", value: String(rows.length), icon: Users },
    { label: "Khả dụng", value: formatLeaveDays(rows.reduce((sum, item) => sum + item.availableAfterPending, 0)), unit: "ngày" },
    { label: "Chờ duyệt", value: formatLeaveDays(rows.reduce((sum, item) => sum + item.pending, 0)), unit: "ngày" },
    { label: "Đã dùng", value: formatLeaveDays(rows.reduce((sum, item) => sum + item.used, 0)), unit: "ngày" }
  ];

  return <div className={styles.view}>
    <section className={styles.surface}>
      <div className={styles.toolbar} data-ui="filter-controls" data-personal={!all || undefined}>
        {all ? <label className={styles.search} data-ui="filter-search"><span className="sr-only">Tìm nhân viên</span><Search aria-hidden="true" size={18} /><input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm tên, mã nhân viên" type="search" value={query} /></label> : null}
        <Input label="Năm" max={2200} min={2000} onBlur={() => { const value = Number(yearInput); if (Number.isInteger(value) && value >= 2000 && value <= 2200) { setYear(value); setPage(1); } else setYearInput(String(year)); }} onChange={(event) => setYearInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} type="number" value={yearInput} />
        <Select disabled={loading || !types.length} label="Loại nghỉ" onChange={(event) => { setLeaveTypeId(event.target.value); setPage(1); }} options={types.map((type) => ({ value: type.id, label: `${type.name} · ${type.code}${!type.active ? " · Ngừng dùng" : ""}` }))} placeholder="Chọn loại nghỉ" value={leaveTypeId} />
        {all ? <Select label="Phòng ban" onChange={(event) => { setDepartment(event.target.value); setPage(1); }} options={[{ value: "", label: "Tất cả phòng ban" }, ...departments.map((value) => ({ value, label: value }))]} value={department} /> : null}
        {canViewSettlement ? <div className={styles.toolbarActions} data-ui="actions"><Link className="button button--secondary button--md" href="/leave/settlements">Tiền phép cuối năm</Link>{canAdjust ? <Button disabled={loading || !types.some((type) => type.id === leaveTypeId && type.active && type.deductsBalance)} onClick={() => setGrantOpen(true)} variant="primary">Cấp phép</Button> : null}</div> : null}
      </div>
      {loading ? <div aria-live="polite" className={styles.loading}><RefreshCw aria-hidden="true" size={20} /><span>Đang tải số dư phép</span></div> : error ? <div className={styles.error} role="alert"><span>{error}</span><Button onClick={() => setReload((value) => value + 1)}>Thử lại</Button></div> : !rows.length ? <div className={styles.empty}><CalendarDays aria-hidden="true" size={26} /><span>{types.length ? "Không có nhân viên phù hợp" : "Chưa có loại nghỉ theo dõi số dư"}</span>{query || department ? <Button onClick={() => { setQuery(""); setDepartment(""); setPage(1); }}>Xóa bộ lọc</Button> : null}</div> : all ? <>
        <div className={styles.summaries}>{summaries.map((item) => <article key={item.label}><span>{item.icon ? <item.icon aria-hidden="true" size={16} /> : null}{item.label}</span><strong>{item.value}{item.unit ? <small> {item.unit}</small> : null}</strong></article>)}</div>
        <div className={styles.tableScroll}><table className={styles.table}><caption className="sr-only">Số dư phép {types.find((type) => type.id === leaveTypeId)?.name} năm {year}</caption>
          <thead><tr><th scope="col">Nhân viên</th>{["Đã cấp", "Chuyển năm", "Điều chỉnh", "Đã dùng", "Chờ duyệt", "Còn lại", "Khả dụng"].map((label) => <th key={label} scope="col">{label}</th>)}<th scope="col"><span className="sr-only">Chi tiết</span></th></tr></thead>
          <tbody>{visibleRows.map((item) => <tr key={item.employeeId}><th scope="row"><button className={styles.employeeButton} onClick={() => setSelectedEmployee(item)} type="button"><strong>{item.employeeName}</strong><span>{item.employeeCode} · {item.departmentName}</span></button></th>{[item.granted, item.carryover, item.adjustments, item.used, item.pending, item.officialRemaining].map((value, index) => <td key={index}>{formatLeaveDays(value)}</td>)}<td><b className={styles.availableNumber} data-negative={item.availableAfterPending < 0 || undefined}>{formatLeaveDays(item.availableAfterPending)}</b></td><td><button aria-label={`Xem phép của ${item.employeeName}`} className={styles.openButton} onClick={() => setSelectedEmployee(item)} type="button"><ChevronRight aria-hidden="true" size={18} /></button></td></tr>)}</tbody>
        </table></div>
        <div className={styles.mobileList}>{visibleRows.map((item) => <article key={item.employeeId}><button className={styles.mobileIdentity} onClick={() => setSelectedEmployee(item)} type="button"><span><strong>{item.employeeName}</strong><small>{item.employeeCode} · {item.departmentName}</small></span><ChevronRight aria-hidden="true" size={18} /></button><dl><div><dt>Khả dụng</dt><dd className={styles.availableNumber} data-negative={item.availableAfterPending < 0 || undefined}>{formatLeaveDays(item.availableAfterPending)}</dd></div><div><dt>Còn lại</dt><dd>{formatLeaveDays(item.officialRemaining)}</dd></div><div><dt>Đã dùng</dt><dd>{formatLeaveDays(item.used)}</dd></div><div><dt>Chờ duyệt</dt><dd>{formatLeaveDays(item.pending)}</dd></div></dl></article>)}</div>
        <footer className={styles.pagination}><span>{rows.length} nhân viên · Đơn vị: ngày</span>{pageCount > 1 ? <div><Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} size="sm">Trước</Button><span>{currentPage} / {pageCount}</span><Button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} size="sm">Sau</Button></div> : null}</footer>
      </> : selected ? <div className={styles.personal}><LeaveBalanceBreakdown balance={selected} /><header className={styles.sectionHeader}><History aria-hidden="true" size={18} /><h2>Biến động phép</h2></header><LeaveLedgerList ledger={ledger.filter((item) => item.leaveTypeId === leaveTypeId)} /></div> : null}
    </section>
    <Drawer className={styles.employeeDrawer} onClose={() => setSelectedEmployee(null)} open={selectedEmployee !== null} title="Chi tiết phép nhân viên">
      {selectedEmployee ? <EmployeeLeavePanel employeeId={selectedEmployee.employeeId} initialLeaveTypeId={leaveTypeId} initialYear={year} key={`${selectedEmployee.employeeId}-${year}-${leaveTypeId}`} onBalanceChange={() => setReload((value) => value + 1)} /> : null}
    </Drawer>
    <Drawer className={styles.adjustmentDrawer} onClose={() => setGrantOpen(false)} open={grantOpen} title="Cấp phép nhân viên">
      {grantOpen ? <LeaveAdjustmentForm initialLeaveTypeId={leaveTypeId} initialYear={year} mode="grant" onSaved={() => { setGrantOpen(false); setReload((value) => value + 1); }} /> : null}
    </Drawer>
  </div>;
}
