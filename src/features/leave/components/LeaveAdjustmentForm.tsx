"use client";

import { Check, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/shared/FormControls";
import type { LeaveBalance, LeaveType } from "@/features/leave/types/leaveTypes";
import { can } from "@/lib/auth/permissions";
import { getBusinessDateKey } from "@/lib/time/timezone";

import styles from "./LeaveAdjustmentForm.module.css";

interface LeaveAdjustmentFormProps {
  initialEmployeeId?: string;
  initialLeaveTypeId?: string;
  initialYear?: number;
  mode?: "grant" | "adjust";
  onSaved?: () => void;
}

interface EmployeeOption {
  id: string;
  employeeCode: string;
  fullName: string;
  displayName?: string;
  departmentName: string;
  employmentStatus: string;
}

async function readData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể tải dữ liệu.");
  return body.data as T;
}
const days = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);

export function LeaveAdjustmentForm({ initialEmployeeId = "", initialLeaveTypeId = "", initialYear, mode, onSaved }: LeaveAdjustmentFormProps = {}) {
  const user = useCurrentUser();
  const canAdjust = can(user.permissions, "leave.balance.adjust");
  const [action, setAction] = useState<"grant" | "adjust">(mode ?? "adjust");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialEmployeeId ? [initialEmployeeId] : []);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [form, setForm] = useState(() => {
    const today = getBusinessDateKey();
    const year = initialYear ?? Number(today.slice(0, 4));
    return { employeeId: initialEmployeeId, leaveTypeId: initialLeaveTypeId, year, direction: "add", amount: 1, reason: "", effectiveDate: year === Number(today.slice(0, 4)) ? today : `${year}-01-01` };
  });
  const idempotencyKey = useRef<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    let active = true;
    if (!canAdjust) { queueMicrotask(() => { if (active) setLoading(false); }); return () => { active = false; }; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    queueMicrotask(() => { if (active) { setLoading(true); setLoadError(""); } });
    void Promise.all([readData<EmployeeOption[]>("/api/v1/leave-balances/employees", controller.signal), readData<LeaveType[]>("/api/v1/leave-types", controller.signal)])
      .then(([employeeItems, definitions]) => {
        if (!active) return;
        const balanceTypes = definitions.filter((type) => type.active && type.deductsBalance);
        setEmployees(employeeItems); setTypes(balanceTypes);
        setForm((current) => ({ ...current, employeeId: employeeItems.some((item) => item.id === current.employeeId) ? current.employeeId : "", leaveTypeId: balanceTypes.some((type) => type.id === current.leaveTypeId) ? current.leaveTypeId : balanceTypes[0]?.id ?? "" }));
        setSelectedIds((current) => current.filter((id) => employeeItems.some((employee) => employee.id === id)));
      }).catch((value: Error) => {
        if (active) setLoadError(controller.signal.aborted ? "Tải dữ liệu quá lâu. Vui lòng thử lại." : value.message);
      }).finally(() => { if (active) setLoading(false); clearTimeout(timeout); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [canAdjust, reload]);

  useEffect(() => {
    let active = true;
    const shouldRead = can(user.permissions, "leave.balance.view_all") && Boolean(form.employeeId && form.leaveTypeId) && Number.isInteger(form.year) && form.year >= 2000 && form.year <= 2200 && action === "adjust";
    queueMicrotask(() => { if (active) { setBalance(null); setBalanceError(""); setBalanceLoading(shouldRead); } });
    if (!shouldRead) return () => { active = false; };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void readData<LeaveBalance[]>(`/api/v1/employees/${form.employeeId}/leave-balance?year=${form.year}`, controller.signal)
      .then((items) => { if (active) setBalance(items.find((item) => item.leaveTypeId === form.leaveTypeId) ?? null); })
      .catch((value: Error) => { if (active) setBalanceError(controller.signal.aborted ? "Không thể tải số dư hiện tại." : value.message); })
      .finally(() => { if (active) setBalanceLoading(false); clearTimeout(timeout); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [action, form.employeeId, form.leaveTypeId, form.year, reload, user.permissions]);

  const filteredEmployees = useMemo(() => {
    const search = employeeQuery.toLocaleLowerCase("vi-VN").trim();
    return employees.filter((item) => !search || `${item.displayName} ${item.fullName} ${item.employeeCode} ${item.departmentName}`.toLocaleLowerCase("vi-VN").includes(search));
  }, [employeeQuery, employees]);
  const changed = () => { idempotencyKey.current = null; setError(""); setSuccess(""); };
  const update = (key: keyof typeof form, value: string | number) => { changed(); setForm((current) => ({ ...current, [key]: value })); };
  const toggleEmployee = (id: string) => { changed(); setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || !canAdjust) return;
    setError(""); setSuccess("");
    if ((action === "grant" ? !selectedIds.length : !form.employeeId) || !form.leaveTypeId) { setError("Chọn nhân viên và loại nghỉ."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    if (action === "grant" && selectedIds.length > 1000) { setError("Mỗi lần cấp phép tối đa 1.000 nhân viên."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    if (!Number.isFinite(form.amount) || form.amount <= 0 || form.amount > 365 || !Number.isInteger(form.year) || form.year < 2000 || form.year > 2200) { setError("Kiểm tra số ngày và năm phép."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    if (form.reason.trim().length < 3) { setError("Lý do cần ít nhất 3 ký tự."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    submitLock.current = true; setBusy(true);
    idempotencyKey.current ??= crypto.randomUUID();
    const body = action === "grant" ? { employeeIds: selectedIds, year: form.year, leaveTypeId: form.leaveTypeId, amount: form.amount, reason: form.reason.trim(), idempotencyKey: idempotencyKey.current } : { ...form, reason: form.reason.trim(), idempotencyKey: idempotencyKey.current };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`/api/v1/leave-balances/${action === "grant" ? "grants" : "adjustments"}`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Không thể lưu phép.");
      const updated = result.data as LeaveBalance | LeaveBalance[];
      setSuccess(action === "grant" ? `Đã cấp ${days(form.amount)} ngày cho ${selectedIds.length} nhân viên.` : `Đã điều chỉnh. Còn lại ${days((updated as LeaveBalance).officialRemaining)} ngày.`);
      if (!Array.isArray(updated)) setBalance(updated);
      idempotencyKey.current = null;
      setForm((current) => ({ ...current, reason: "" }));
      requestAnimationFrame(() => successRef.current?.focus());
      onSaved?.();
    } catch (value) {
      setError(controller.signal.aborted ? "Chưa nhận được kết quả. Bấm Lưu lại để kiểm tra cùng giao dịch." : value instanceof Error ? value.message : "Không thể lưu phép.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { clearTimeout(timeout); submitLock.current = false; setBusy(false); }
  }

  if (!canAdjust) return <section className={styles.surface}><div className={styles.empty}>Bạn không có quyền điều chỉnh phép.</div></section>;
  return <section className={styles.surface}>
    {!mode ? <nav aria-label="Thao tác phép" className={styles.tabs}><button aria-pressed={action === "adjust"} disabled={busy} onClick={() => { changed(); setAction("adjust"); }} type="button">Điều chỉnh</button><button aria-pressed={action === "grant"} disabled={busy} onClick={() => { changed(); setAction("grant"); }} type="button">Cấp phép</button></nav> : null}
    {loading ? <div aria-live="polite" className={styles.empty}><RefreshCw aria-hidden="true" size={20} />Đang tải nhân viên và loại nghỉ</div> : loadError ? <div className={styles.error} role="alert"><span>{loadError}</span><Button onClick={() => setReload((value) => value + 1)}>Thử lại</Button></div> : !employees.length || !types.length ? <div className={styles.empty}>{!employees.length ? "Chưa có nhân viên để cấp hoặc điều chỉnh phép" : "Chưa có loại nghỉ theo dõi số dư"}</div> : <form className={styles.form} onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className={styles.grid}>
          <Select label="Loại nghỉ" onChange={(event) => update("leaveTypeId", event.target.value)} options={types.map((type) => ({ label: `${type.name} · ${type.code}`, value: type.id }))} required value={form.leaveTypeId} />
          <Input label="Năm phép" max={2200} min={2000} onChange={(event) => update("year", Number(event.target.value))} required type="number" value={form.year} />
          {action === "adjust" ? <Select label="Nhân viên" onChange={(event) => update("employeeId", event.target.value)} options={employees.map((employee) => ({ value: employee.id, label: `${employee.displayName || employee.fullName} · ${employee.employeeCode}` }))} placeholder="Chọn nhân viên" required value={form.employeeId} /> : null}
          {action === "adjust" ? <Select label="Điều chỉnh" onChange={(event) => update("direction", event.target.value)} options={[{ label: "Cộng phép", value: "add" }, { label: "Trừ phép", value: "subtract" }]} value={form.direction} /> : null}
          <Input label={action === "grant" ? "Số ngày mỗi nhân viên" : "Số ngày"} max={365} min={0.01} onChange={(event) => update("amount", Number(event.target.value))} required step="0.01" type="number" value={form.amount} />
          {action === "adjust" ? <Input label="Ngày hiệu lực" onChange={(event) => update("effectiveDate", event.target.value)} required type="date" value={form.effectiveDate} /> : null}
        </div>
        {action === "grant" ? <section aria-label="Nhân viên được cấp phép" className={styles.employeeSelection}>
          <header><strong>Nhân viên</strong><span>Đã chọn {selectedIds.length} / 1.000</span></header>
          <label className={styles.search}><Search aria-hidden="true" size={17} /><span className="sr-only">Tìm nhân viên để cấp phép</span><input onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Tìm tên, mã hoặc phòng ban" type="search" value={employeeQuery} /></label>
          <div className={styles.selectionActions}><Button disabled={!filteredEmployees.length} leftIcon={<Check aria-hidden="true" size={15} />} onClick={() => { changed(); setSelectedIds((current) => [...new Set([...current, ...filteredEmployees.map((employee) => employee.id)])]); }} size="sm">Chọn {filteredEmployees.length} người</Button><Button disabled={!selectedIds.length} onClick={() => { changed(); setSelectedIds([]); }} size="sm" variant="ghost">Bỏ chọn</Button></div>
          <div className={styles.employeeList}>{filteredEmployees.length ? filteredEmployees.map((employee) => <div className={styles.employeeOption} key={employee.id}><Checkbox checked={selectedIds.includes(employee.id)} label={`${employee.displayName || employee.fullName} · ${employee.employeeCode}`} onChange={() => toggleEmployee(employee.id)} /><span>{employee.departmentName}</span></div>) : <div className={styles.empty}>Không có nhân viên phù hợp</div>}</div>
        </section> : null}
        {action === "adjust" && balanceLoading ? <div aria-live="polite" className={styles.balanceLoading}>Đang tải số dư hiện tại</div> : action === "adjust" && balanceError ? <div className={styles.error} role="alert">{balanceError}</div> : action === "adjust" && balance ? <dl className={styles.balancePreview}><div><dt>Còn lại hiện tại</dt><dd>{days(balance.officialRemaining)} ngày</dd></div><div><dt>Còn lại dự kiến</dt><dd>{days(balance.officialRemaining + (form.direction === "add" ? form.amount : -form.amount))} ngày</dd></div></dl> : null}
        <Textarea label="Lý do" maxLength={500} minLength={3} onChange={(event) => update("reason", event.target.value)} required rows={3} value={form.reason} />
      </fieldset>
      {error ? <div className={styles.error} ref={errorRef} role="alert" tabIndex={-1}>{error}</div> : null}
      {success ? <div className={styles.success} ref={successRef} role="status" tabIndex={-1}><CheckCircle2 aria-hidden="true" size={19} /><span>{success}</span></div> : null}
      <footer className={styles.footer}><Button busy={busy} disabled={!types.length || (action === "grant" ? !selectedIds.length || selectedIds.length > 1000 : !form.employeeId)} type="submit" variant="primary">{busy ? "Đang lưu" : action === "grant" ? `Cấp phép${selectedIds.length ? ` (${selectedIds.length})` : ""}` : "Lưu điều chỉnh"}</Button></footer>
    </form>}
  </section>;
}
