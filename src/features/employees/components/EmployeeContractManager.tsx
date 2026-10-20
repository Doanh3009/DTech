"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Archive, FileUp, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { DatePicker, Input, Select, Textarea } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { DataSurface } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { EmployeeContract } from "@/features/employees/types";
import { buildInternalFileUrl } from "@/services/storage/storageService";
import styles from "./EmployeeContractManager.module.css";

const statusLabels = { draft: "Nháp", active: "Đang hiệu lực", expired: "Hết hạn", terminated: "Đã chấm dứt" } as const;
const date = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`)) : "—";
type ContractTemplateOption={id:string;name:string};

export function EmployeeContractManager({ employeeId, initialContracts, canEdit, canUpload, canViewFile }: { employeeId: string; initialContracts: EmployeeContract[]; canEdit: boolean; canUpload: boolean; canViewFile: boolean }) {
  const [contracts, setContracts] = useState(initialContracts);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templates,setTemplates]=useState<ContractTemplateOption[]>([]);
  const [fileHistory, setFileHistory] = useState<EmployeeContract>();
  const [editing, setEditing] = useState<EmployeeContract>();
  const [archiving, setArchiving] = useState<EmployeeContract>();
  const [archiveReason, setArchiveReason] = useState("");
  const mutation = useRef(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function reload() {
    const response = await fetch(`/api/v1/employees/${employeeId}/contracts`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Không thể đọc lịch sử hợp đồng.");
    const rows = body.data?.contracts ?? [];
    setContracts(rows);
    setTemplates(body.data?.templates??[]);
    return rows as EmployeeContract[];
  }

  async function showFileHistory(contract: EmployeeContract) {
    setError("");
    try {
      const rows = await reload();
      setFileHistory(rows.find((row) => row.id === contract.id) ?? contract);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đọc lịch sử file hợp đồng.");
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (mutation.current) return; mutation.current = true; setBusy(true); setError("");
    const formElement = event.currentTarget;
    try {
      const response = await fetch(`/api/v1/employees/${employeeId}/contracts${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", body: new FormData(formElement), signal: AbortSignal.timeout(30_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu hợp đồng.");
      setOpen(false); setEditing(undefined); formElement.reset(); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { mutation.current = false; setBusy(false); }
  }

  async function replaceFile(contract: EmployeeContract, file?: File) {
    if (!file || mutation.current) return; mutation.current = true; setBusy(true); setError("");
    const form = new FormData();
    form.set("fileOnly", "true"); form.set("rowVersion", String(contract.rowVersion ?? 1)); form.set("file", file);
    try {
      const response = await fetch(`/api/v1/employees/${employeeId}/contracts/${contract.id}`, { method: "PATCH", body: form, signal: AbortSignal.timeout(30_000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Không thể thay file hợp đồng.");
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { mutation.current = false; setBusy(false); const input = fileInputs.current[contract.id]; if (input) input.value = ""; }
  }

  async function archive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!archiving || mutation.current) return;
    if (archiveReason.trim().length < 3) { setError("Cần nhập lý do ít nhất 3 ký tự."); return; }
    mutation.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/employees/${employeeId}/contracts/${archiving.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: archiveReason.trim(), rowVersion: archiving.rowVersion ?? 1 }), signal: AbortSignal.timeout(30_000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu trữ hợp đồng.");
      setArchiving(undefined); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { mutation.current = false; setBusy(false); }
  }

  const columns: DataTableColumn<EmployeeContract>[] = [
    { id: "number", header: "Số hợp đồng", accessor: "contractNumber", priority: "primary" },
    { id: "type", header: "Loại", accessor: "contractType" },
    { id: "signed", header: "Ngày ký", cell: (item) => date(item.signedDate), hiddenOnMobile: true },
    { id: "effective", header: "Hiệu lực", cell: (item) => date(item.effectiveDate ?? item.startDate) },
    { id: "end", header: "Hết hạn", cell: (item) => date(item.endDate), hiddenOnMobile: true },
    { id: "status", header: "Trạng thái", cell: (item) => <StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge> },
    { id: "file", header: "Tài liệu", cell: (item) => item.attachmentFileId && canViewFile ? <Link className="private-file-link" href={buildInternalFileUrl(item.attachmentFileId)}>{item.attachmentMimeType?.includes("wordprocessingml")?"Tải file Word":"Xem tài liệu"}</Link> : "—" }
  ];

  const renderActions = (contract: EmployeeContract) => {
    const canArchive = canEdit && !contract.archivedAt;
    const canReadHistory = canViewFile && Boolean(contract.attachmentFileId);
    if (!canUpload && !canArchive && !canReadHistory) return "—";
    return <><input accept="application/pdf" hidden onChange={(event)=>void replaceFile(contract,event.target.files?.[0])} ref={(node)=>{fileInputs.current[contract.id]=node;}} type="file"/><DropdownMenu label={`Thao tác hợp đồng ${contract.contractNumber}`} mobileTriggerLabel="Thao tác">{canReadHistory?<button onClick={()=>void showFileHistory(contract)} type="button">Lịch sử file</button>:null}{canEdit&&!contract.archivedAt?<button disabled={busy} onClick={()=>{setEditing(contract);setError("");setOpen(true);}} type="button"><Pencil aria-hidden="true" size={14}/>Sửa hợp đồng</button>:null}{canUpload&&!contract.archivedAt?<button disabled={busy} onClick={()=>fileInputs.current[contract.id]?.click()} type="button"><FileUp aria-hidden="true" size={14}/>{contract.attachmentFileId?"Thay file":"Tải file"}</button>:null}{canArchive?<button disabled={busy} onClick={()=>{setArchiving(contract);setArchiveReason("");setError("");}} type="button"><Archive aria-hidden="true" size={14}/>Lưu trữ</button>:null}</DropdownMenu></>;
  };

  return <>
    <DataSurface className={styles.surface}>
      <div className="data-surface__toolbar panel-header"><h2>Hợp đồng lao động</h2>{canEdit ? <Button disabled={busy} leftIcon={<Plus size={15}/>} onClick={()=>{setEditing(undefined);setError("");void reload().then(()=>setOpen(true)).catch(reason=>setError(reason instanceof Error?reason.message:"Không thể tải hợp đồng."));}} size="sm" variant="primary">Thêm hợp đồng</Button> : null}</div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <DataTable ariaLabel="Hợp đồng lao động" actions={canEdit || canUpload || canViewFile ? renderActions : undefined} columns={columns} data={contracts} emptyDescription="" emptyTitle="Chưa có hợp đồng" getRowId={(contract)=>contract.id}/>
    </DataSurface>
    <Drawer onClose={()=>setFileHistory(undefined)} open={Boolean(fileHistory)} title={`Lịch sử file · ${fileHistory?.contractNumber??""}`}>
      <ul className={`warehouse-simple-list ${styles.history}`}>{(fileHistory?.fileVersions??[]).map((version)=><li key={version.fileId}><Link className="private-file-link" href={buildInternalFileUrl(version.fileId)} target="_blank">{version.fileName}</Link><span>{version.fileId===fileHistory?.attachmentFileId?"Hiện tại · ":"Bản trước · "}{new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(version.uploadedAt))}</span></li>)}{!fileHistory?.fileVersions?.length?<li>Chưa có lịch sử file</li>:null}</ul>
    </Drawer>
    <Drawer onClose={()=>{if(!busy)setOpen(false);}} open={open} title={editing?"Sửa hợp đồng lao động":"Thêm hợp đồng lao động"}><form className={`overlay-form ${styles.form}`} key={editing?.id??"new"} onSubmit={create}>
      {editing?<input name="rowVersion" type="hidden" value={editing.rowVersion ?? 1}/>:null}<Input defaultValue={editing?.contractNumber} label="Số hợp đồng" name="contractNumber" required/><Input defaultValue={editing?.contractType} label="Loại hợp đồng" name="contractType" required/><DatePicker defaultValue={editing?.signedDate} label="Ngày ký" name="signedDate"/><DatePicker defaultValue={editing?.effectiveDate??editing?.startDate} label="Ngày hiệu lực" name="effectiveDate" required/><DatePicker defaultValue={editing?.endDate} label="Ngày hết hạn" name="endDate"/><Select defaultValue={editing?.status??"draft"} label="Trạng thái" name="status" options={Object.entries(statusLabels).map(([value,label])=>({value,label}))}/>{!editing&&canUpload&&templates.length?<Select label="Mẫu Word" name="templateId" options={templates.map(template=>({value:template.id,label:template.name}))} placeholder="Không dùng mẫu"/>:null}{canUpload?<Input accept="application/pdf" label="File hợp đồng PDF" name="file" type="file"/>:null}<div className={styles.fullWidth}><Textarea defaultValue={editing?.note} label="Ghi chú" name="note"/></div>{error?<p className="form-error" role="alert">{error}</p>:null}<footer><Button disabled={busy} onClick={()=>setOpen(false)}>Hủy</Button><Button disabled={busy} type="submit" variant="primary" busy={busy}>{editing?"Lưu thay đổi":"Lưu hợp đồng"}</Button></footer>
    </form></Drawer>
    <Drawer onClose={()=>{if(!busy)setArchiving(undefined);}} open={Boolean(archiving)} title={`Lưu trữ · ${archiving?.contractNumber??""}`}><form className={`drawer-form ${styles.archiveForm}`} onSubmit={archive}><Input label="Lý do lưu trữ" maxLength={500} minLength={3} onChange={(event)=>setArchiveReason(event.target.value)} required value={archiveReason}/>{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button disabled={busy} onClick={()=>setArchiving(undefined)}>Hủy</Button><Button busy={busy} disabled={archiveReason.trim().length<3} type="submit" variant="danger">Lưu trữ hợp đồng</Button></div></form></Drawer>
  </>;
}
