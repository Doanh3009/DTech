"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { Input } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { DataSurface, PageContainer } from "@/components/shared/PageLayouts";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { formatBusinessDate, getBusinessDateKey } from "@/lib/time/timezone";
import { ShiftAssignmentForm } from "./ShiftAssignmentForm";
import type { Shift } from "../types/timesheetTypes";
import styles from "./TimesheetForms.module.css";

type ShiftVersion = { id: string; shift_id: string; version: number; name: string; start_time: string; end_time: string; effective_from: string; effective_to?: string | null; reason: string };
const scopeLabels: Record<string, string> = { company: "Toàn công ty", department: "Phòng ban", project: "Dự án", employee: "Nhân viên" };

export function ShiftSettings({ canEdit = false }: { canEdit?: boolean }) {
  const [items, setItems] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [versions, setVersions] = useState<ShiftVersion[]>([]);
  const [editing, setEditing] = useState<Shift>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/shifts", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message);
    setItems(body.data.shifts); setAssignments(body.data.assignments); setVersions(body.data.versions ?? []);
  }, []);
  useEffect(() => { queueMicrotask(() => void load().catch((reason) => setError(reason.message))); }, [load]);
  useDomainReconciliation("timesheets", load);

  function closeEditor() { setEditorOpen(false); setEditing(undefined); }
  function openCreate() { setEditing(undefined); setEditorOpen(true); }
  function openEdit(shift: Shift) { setEditing(shift); setEditorOpen(true); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const payload = { id: editing?.id, code: form.get("code"), name: form.get("name"), startTime: form.get("startTime"), endTime: form.get("endTime"), breakMinutes: Number(form.get("breakMinutes")), lateGraceMinutes: Number(form.get("lateGraceMinutes")), earlyLeaveGraceMinutes: Number(form.get("earlyLeaveGraceMinutes")), checkInEarliestMinutes: editing?.checkInEarliestMinutes ?? 120, checkInLatestMinutes: editing?.checkInLatestMinutes ?? 240, checkOutEarliestMinutes: editing?.checkOutEarliestMinutes ?? 0, checkOutLatestMinutes: editing?.checkOutLatestMinutes ?? 360, crossMidnight: form.get("crossMidnight") === "on", active: true, effectiveFrom: editing ? form.get("effectiveFrom") : undefined, reason: editing ? form.get("reason") : undefined };
    const response = await fetch("/api/v1/shifts", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json();
    if (!response.ok) { setError(body.error?.message ?? "Không thể lưu ca làm."); return; }
    setError(""); closeEditor(); await load();
  }

  const shiftColumns: DataTableColumn<Shift>[] = [
    { id: "code", header: "Mã", accessor: "code" }, { id: "name", header: "Tên", accessor: "name", priority: "primary" },
    { id: "hours", header: "Giờ làm", cell: (item) => `${item.startTime} – ${item.endTime}${item.crossMidnight ? " · Kết thúc hôm sau" : ""}` },
    { id: "break", header: "Nghỉ", cell: (item) => `${item.breakMinutes}'`, hiddenOnMobile: true },
    { id: "late", header: "Đi trễ", cell: (item) => `${item.lateGraceMinutes}'`, hiddenOnMobile: true },
    { id: "early", header: "Về sớm", cell: (item) => `${item.earlyLeaveGraceMinutes}'`, hiddenOnMobile: true }
  ];
  const versionColumns: DataTableColumn<ShiftVersion>[] = [{ id: "shift", header: "Ca", accessor: "name", priority: "primary" }, { id: "version", header: "Phiên bản", cell: (item) => `v${item.version}` }, { id: "hours", header: "Giờ làm", cell: (item) => `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)}` }, { id: "effective", header: "Hiệu lực", cell: (item) => `${formatBusinessDate(item.effective_from)} → ${item.effective_to ? formatBusinessDate(item.effective_to) : "Hiện tại"}` }, { id: "reason", header: "Lý do", accessor: "reason", hiddenOnMobile: true }];

  return <PageContainer className="shift-settings">
    {error && !editorOpen ? <p className="form-error" role="alert">{error}</p> : null}
    <DataSurface><header className="data-surface__toolbar"><h3 className="section-title">Ca làm hiện tại</h3>{canEdit ? <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={openCreate} type="button" variant="primary">Thêm ca mới</Button> : null}</header><DataTable actions={canEdit ? (item) => <DropdownMenu label={`Thao tác ca ${item.name}`}><button onClick={() => openEdit(item)} type="button">Chỉnh sửa</button></DropdownMenu> : undefined} columns={shiftColumns} data={items} emptyDescription="" emptyTitle="Chưa có ca làm" getRowId={(item) => item.id} /></DataSurface>
    <DataSurface><header className="data-surface__toolbar"><h3 className="section-title">Gán ca</h3><span>{assignments.length} lượt gán</span></header><div className={styles.assignments}>{assignments.length ? assignments.map((item) => <div key={String(item.id)}><span>{scopeLabels[String(item.scope_type)] ?? String(item.scope_type)}</span><strong>{items.find((shift) => shift.id === item.shift_id)?.name ?? "—"}</strong><span>{formatBusinessDate(String(item.effective_from))}</span></div>) : <p>Chưa có lượt gán ca</p>}</div></DataSurface>
    <DataSurface><header className="data-surface__toolbar"><h3 className="section-title">Lịch sử phiên bản</h3></header><DataTable columns={versionColumns} data={versions} emptyDescription="" emptyTitle="Chưa có phiên bản" getRowId={(item) => item.id} /></DataSurface>
    {canEdit ? <ShiftAssignmentForm onAssigned={() => void load().catch((reason) => setError(reason.message))} shifts={items} /> : null}
    <Modal className={styles.editor} onClose={closeEditor} open={editorOpen} title={editing ? "Tạo phiên bản ca" : "Thêm ca mới"}><form className={`drawer-form leave-form ${styles.stack}`} key={editing?.id ?? "new"} onSubmit={submit}>{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-grid"><Input defaultValue={editing?.code} label="Mã ca" name="code" required /><Input defaultValue={editing?.name} label="Tên ca" name="name" required /><Input defaultValue={editing?.startTime} label="Bắt đầu" name="startTime" required type="time" /><Input defaultValue={editing?.endTime} label="Kết thúc" name="endTime" required type="time" /><Input defaultValue={editing?.breakMinutes ?? 60} label="Nghỉ giữa ca (phút)" min="0" name="breakMinutes" required type="number" /><Input defaultValue={editing?.lateGraceMinutes ?? 5} label="Cho phép đi trễ (phút)" min="0" name="lateGraceMinutes" required type="number" /><Input defaultValue={editing?.earlyLeaveGraceMinutes ?? 5} label="Cho phép về sớm (phút)" min="0" name="earlyLeaveGraceMinutes" required type="number" />{editing ? <Input defaultValue={getBusinessDateKey()} label="Áp dụng từ" name="effectiveFrom" required type="date" /> : null}{editing ? <Input label="Lý do thay đổi" name="reason" required /> : null}<label className="choice-field"><input className="checkbox" defaultChecked={editing?.crossMidnight} name="crossMidnight" type="checkbox" />Kết thúc vào ngày hôm sau</label></div><div className="form-actions"><Button onClick={closeEditor} type="button" variant="secondary">Hủy</Button><Button type="submit" variant="primary">{editing ? "Lưu phiên bản" : "Lưu ca"}</Button></div></form></Modal>
  </PageContainer>;
}
