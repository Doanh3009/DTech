"use client";

/* eslint-disable react-hooks/set-state-in-effect -- accounting data is loaded from the API. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Banknote, Plus } from "lucide-react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { FilterBar } from "@/components/shared/FilterBar";
import { Input, SearchInput, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatBusinessDate, formatBusinessDateTime, getBusinessDateKey } from "@/lib/time/timezone";
import type { SalaryRecord } from "../types";
import styles from "./SalaryConsole.module.css";

type Person = { id: string; code: string; name: string };
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export function SalaryConsole({ canEdit, canViewHistory }: { canEdit: boolean; canViewHistory: boolean }) {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<Person[]>([]);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<SalaryRecord>();
  const [deleting, setDeleting] = useState<SalaryRecord>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutation = useRef(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/accounting/salaries", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message);
    setRecords(body.data.records);
    setEmployees(body.data.employees);
    setLoaded(true);
  }, []);

  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, [load]);
  const latest = useMemo(() => {
    const seen = new Set<string>();
    return records.filter((item) => {
      if (seen.has(item.employeeId)) return false;
      seen.add(item.employeeId);
      return true;
    });
  }, [records]);
  const history = historyEmployeeId ? records.filter((item) => item.employeeId === historyEmployeeId) : [];
  const visible = latest.filter((item) => `${item.employeeName} ${item.employeeCode}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));

  function beginEdit(item: SalaryRecord) {
    setError("");
    setEditing(item);
    setSelected(item.employeeId);
    setDrawerOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.current) return;
    mutation.current = true; setSaving(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
    const response = await fetch("/api/v1/accounting/salaries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employeeId: selected, baseSalary: Number(form.get("baseSalary")), allowance: Number(form.get("allowance")), bonus: Number(form.get("bonus")), deduction: Number(form.get("deduction")), effectiveDate: form.get("effectiveDate"), note: form.get("note") || undefined, reason: form.get("reason") }), signal: AbortSignal.timeout(30_000)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu mức lương.");
    setError(""); formElement.reset(); setSelected(""); setEditing(undefined); setDrawerOpen(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { mutation.current = false; setSaving(false); }
  }

  async function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleting || mutation.current) return;
    mutation.current = true; setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
    const response = await fetch(`/api/v1/accounting/salaries/${deleting.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: form.get("reason") }), signal: AbortSignal.timeout(30_000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể xóa hồ sơ lương.");
    setError(""); setDeleting(undefined); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { mutation.current = false; setSaving(false); }
  }

  const columns = useMemo<DataTableColumn<SalaryRecord>[]>(() => [
    { id: "employee", header: "Nhân viên", priority: "primary", cell: (item) => <span className={styles.employee}><strong>{item.employeeName}</strong><small>{item.employeeCode}</small></span> },
    { id: "effective", header: "Hiệu lực", cell: (item) => formatBusinessDate(item.effectiveDate) },
    { id: "salary", header: "Lương cơ bản", cell: (item) => money(item.baseSalary), align: "right" },
    { id: "allowance", header: "Phụ cấp", cell: (item) => money(item.allowance), hiddenOnMobile: true, align: "right" },
    { id: "bonus", header: "Thưởng", cell: (item) => money(item.bonus), hiddenOnMobile: true, align: "right" },
    { id: "deduction", header: "Khấu trừ", cell: (item) => money(item.deduction), hiddenOnMobile: true, align: "right" }
  ], []);

  return (
    <ListPageLayout className="salary-console">
      <PageHeader action={canEdit ? <Button disabled={!loaded || saving} leftIcon={<Plus aria-hidden="true" size={18} />} onClick={() => { setError(""); setEditing(undefined); setSelected(""); setDrawerOpen(true); }} variant="primary">Ghi nhận mức lương</Button> : undefined} title="Hồ sơ lương" />
      <DataSurface className="salary-console__surface">
        <div className="data-surface__toolbar panel-header salary-console__toolbar">
          <div className="salary-console__heading">
            <span aria-hidden="true" className="salary-console__icon"><Banknote size={21} /></span>
            <div><h2>Hồ sơ lương hiện tại</h2><span>{latest.length} hồ sơ</span></div>
          </div>
        </div>
        <div className={styles.toolbar} data-ui="filter-controls"><SearchInput aria-label="Tìm hồ sơ lương theo nhân viên" placeholder="Tên, mã nhân viên" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{visible.length} / {latest.length} hồ sơ</span></div>
        <DataTable
          actions={canViewHistory || canEdit ? (item) => <DropdownMenu label={`Thao tác lương ${item.employeeName}`}>{canEdit ? <><button disabled={saving} onClick={() => beginEdit(item)} type="button">Sửa mức lương</button><button disabled={saving} onClick={() => { setError(""); setDeleting(item); }} type="button">Xóa mức lương</button></> : null}{canViewHistory ? <button onClick={() => setHistoryEmployeeId(item.employeeId)} type="button">Lịch sử</button> : null}</DropdownMenu> : undefined}
          columns={columns}
          data={visible}
          emptyDescription=""
          emptyTitle="Chưa có hồ sơ lương"
          error={drawerOpen || deleting ? undefined : error}
          getRowId={(item) => item.id}
          loading={!loaded && !error}
        />
      </DataSurface>
      {error && !drawerOpen && !deleting ? <Button onClick={() => { setError(""); void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể đọc hồ sơ lương.")); }}>Tải lại</Button> : null}
      <Drawer onClose={() => setHistoryEmployeeId(undefined)} open={Boolean(historyEmployeeId)} title={`Nhật ký lương · ${history[0]?.employeeName ?? ""}`}>
        <ol className={`salary-history-list ${styles.history}`}>{history.map((item, index) => <li key={item.id}><div><strong>{money(item.baseSalary)}</strong><span>{formatBusinessDate(item.effectiveDate)}</span></div><p>{item.reason}</p><small>{index + 1 < history.length ? `${money(history[index + 1].baseSalary)} → ${money(item.baseSalary)}` : "Mức lương đầu tiên"}</small></li>)}</ol>
      </Drawer>
      <Drawer onClose={() => { if (!saving) { setDrawerOpen(false); setEditing(undefined); } }} open={drawerOpen} title={editing ? `Điều chỉnh mức lương · ${editing.employeeName}` : "Ghi nhận mức lương"}>
        <form className={`leave-form drawer-form ${styles.editor}`} key={editing?.id ?? "new"} onSubmit={submit}>
          {error ? <p className={`form-error ${styles.fullWidth}`} role="alert">{error}</p> : null}
          <div className={styles.fullWidth}><Select disabled={Boolean(editing)} label="Nhân viên" onChange={(event) => setSelected(event.target.value)} options={employees.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} placeholder="Chọn nhân viên" required value={selected} /></div>
          <Input defaultValue={editing?.baseSalary} label="Lương cơ bản" min="0" name="baseSalary" required type="number" />
          <Input defaultValue={editing?.allowance ?? 0} label="Phụ cấp" min="0" name="allowance" required type="number" />
          <Input defaultValue={editing?.bonus ?? 0} label="Thưởng" min="0" name="bonus" required type="number" />
          <Input defaultValue={editing?.deduction ?? 0} label="Khấu trừ" min="0" name="deduction" required type="number" />
          <div className={styles.fullWidth}><Input defaultValue={editing?.effectiveDate ?? getBusinessDateKey()} label="Hiệu lực từ" name="effectiveDate" required type="date" /></div>
          <div className={styles.fullWidth}><Input defaultValue={editing ? `Điều chỉnh mức lương ${editing.employeeName}` : undefined} label="Lý do" name="reason" required /></div>
          <div className={styles.fullWidth}><Input defaultValue={editing?.note} label="Ghi chú" name="note" /></div>
          <div className="form-actions"><Button disabled={saving} onClick={() => { setDrawerOpen(false); setEditing(undefined); }} type="button">Hủy</Button><Button busy={saving} type="submit" variant="primary">{editing ? "Ghi nhận điều chỉnh" : "Lưu mức lương"}</Button></div>
        </form>
      </Drawer>
      <Drawer onClose={() => { if (!saving) setDeleting(undefined); }} open={Boolean(deleting)} title={`Xóa mức lương · ${deleting?.employeeName ?? ""}`}>
        {deleting ? <form className={`drawer-form ${styles.singleForm}`} onSubmit={submitDelete}><div className={`salary-delete-summary ${styles.deleteSummary}`}><strong>{money(deleting.baseSalary)}</strong><span>Hiệu lực {formatBusinessDate(deleting.effectiveDate)}</span></div><Input label="Lý do xóa" name="reason" required minLength={3}/>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><Button disabled={saving} onClick={() => setDeleting(undefined)}>Hủy</Button><Button busy={saving} type="submit" variant="danger">Xóa mức lương</Button></div></form> : null}
      </Drawer>
    </ListPageLayout>
  );
}

export function SalaryHistoryConsole() {
  const [records, setRecords] = useState<SalaryRecord[]>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/v1/accounting/salaries", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể đọc nhật ký lương.");
      setRecords(body.data.records as SalaryRecord[]);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể đọc nhật ký lương."));
  }, []);
  const previous = useMemo(() => {
    const rows = records ?? [];
    const result = new Map<string, SalaryRecord>();
    const olderByEmployee = new Map<string, SalaryRecord>();
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index];
      const older = olderByEmployee.get(row.employeeId);
      if (older) result.set(row.id, older);
      olderByEmployee.set(row.employeeId, row);
    }
    return result;
  }, [records]);
  const filtered = useMemo(() => (records ?? []).filter((row) => `${row.employeeCode} ${row.employeeName} ${row.reason}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))), [records, search]);
  const columns: DataTableColumn<SalaryRecord>[] = [
    { id: "employee", header: "Nhân viên", priority: "primary", cell: (row) => <span className={styles.employee}><strong>{row.employeeName}</strong><small>{row.employeeCode}</small></span> },
    { id: "effective", header: "Hiệu lực từ", cell: (row) => formatBusinessDate(row.effectiveDate) },
    { id: "base", header: "Lương cơ bản", cell: (row) => <>{previous.has(row.id) ? `${money(previous.get(row.id)!.baseSalary)} → ` : ""}{money(row.baseSalary)}</> },
    { id: "extras", header: "Phụ cấp / Thưởng / Khấu trừ", cell: (row) => `${money(row.allowance)} · ${money(row.bonus)} · ${money(row.deduction)}`, hiddenOnMobile: true },
    { id: "reason", header: "Lý do", accessor: "reason" },
    { id: "changed", header: "Ghi nhận", cell: (row) => <>{row.changedByName ?? "—"}<br /><small>{formatBusinessDateTime(row.changedAt)}</small></> }
  ];
  return <ListPageLayout><DataSurface><div className="data-surface__toolbar"><FilterBar><SearchInput onChange={(event) => setSearch(event.target.value)} placeholder="Nhân viên, mã, lý do" value={search} /></FilterBar></div><DataTable columns={columns} data={filtered} emptyDescription="" emptyTitle="Chưa có thay đổi lương" error={error} getRowId={(row) => row.id} loading={!records && !error} /></DataSurface></ListPageLayout>;
}
