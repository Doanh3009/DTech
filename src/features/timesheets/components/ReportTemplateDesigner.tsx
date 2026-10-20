"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Pencil } from "lucide-react";
import { Card } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { FileDownloadLink } from "@/components/shared/FileDownloadLink";
import { DataSurface, ReportPageTemplate } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { reportFieldRegistry } from "../services/reportFieldRegistry";
import type { ReportExport, ReportSheetDefinition, ReportTemplate } from "../types/timesheetTypes";

type EditableTemplate = Omit<ReportTemplate, "id"> & { id?: string };
const reportTypeLabel = { timesheet: "Bảng công", employee_list: "Danh sách nhân sự", employee_profile: "Hồ sơ nhân viên" };

function initializedSheet(sheet: ReportSheetDefinition): ReportSheetDefinition {
  if (sheet.columns?.length) return sheet;
  return {
    ...sheet,
    columns: (reportFieldRegistry[sheet.key] ?? []).map((field, order) => ({ key: field.key, label: field.label, enabled: true, order }))
  };
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function ReportTemplateDesigner() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [exports, setExports] = useState<ReportExport[]>([]);
  const [editing, setEditing] = useState<EditableTemplate>();
  const [activeSheet, setActiveSheet] = useState(0);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [templateResponse, exportResponse] = await Promise.all([fetch("/api/v1/report-templates"), fetch("/api/v1/report-exports")]);
    const [templateBody, exportBody] = await Promise.all([templateResponse.json(), exportResponse.json()]);
    if (!templateResponse.ok) throw new Error(templateBody.error?.message);
    if (!exportResponse.ok) throw new Error(exportBody.error?.message);
    setTemplates(templateBody.data);
    setExports(exportBody.data);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((error: Error) => setMessage(error.message)), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sheet = editing?.definition.sheets[activeSheet];
  const orderedColumns = useMemo(() => [...(sheet?.columns ?? [])].sort((a, b) => a.order - b.order), [sheet]);
  const templateColumns = useMemo<DataTableColumn<ReportTemplate>[]>(() => [
    { id: "code", header: "Mã", accessor: "code" },
    { id: "name", header: "Tên", accessor: "name" },
    { id: "type", header: "Loại", cell: (item) => reportTypeLabel[item.reportType] },
    { id: "version", header: "Phiên bản", cell: (item) => `v${item.version}` },
    { id: "status", header: "Trạng thái", cell: (item) => <StatusBadge tone={item.active ? "success" : "neutral"}>{item.active ? "Đang dùng" : "Tắt"}</StatusBadge> }
  ], []);
  const exportColumns = useMemo<DataTableColumn<ReportExport>[]>(() => [
    { id: "file", header: "Tệp", cell: (item) => item.fileName || item.id },
    { id: "type", header: "Loại", cell: (item) => reportTypeLabel[item.reportType] },
    { id: "template", header: "Mẫu", cell: (item) => `v${item.templateVersion}` },
    { id: "period", header: "Kỳ", cell: (item) => item.periodVersion == null ? "—" : `v${item.periodVersion}` },
    { id: "time", header: "Thời gian", cell: (item) => new Date(item.requestedAt).toLocaleString("vi-VN"), hiddenOnMobile: true },
    { id: "status", header: "Trạng thái", accessor: "status" }
  ], []);

  function edit(item: ReportTemplate, duplicate = false) {
    const copy: EditableTemplate = structuredClone(item);
    copy.definition.sheets = copy.definition.sheets.map(initializedSheet);
    if (duplicate) {
      delete copy.id;
      copy.code = `${copy.code.slice(0, 30)}_COPY`;
      copy.name = `${copy.name} - Bản sao`;
      copy.version = 1;
    }
    setEditing(copy);
    setActiveSheet(0);
    setPreview(false);
  }

  function updateSheets(sheets: ReportSheetDefinition[]) {
    if (editing) setEditing({ ...editing, definition: { ...editing.definition, sheets } });
  }

  function updateSheet(patch: Partial<ReportSheetDefinition>) {
    if (!editing) return;
    updateSheets(editing.definition.sheets.map((item, index) => index === activeSheet ? { ...item, ...patch } : item));
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const columns = move(orderedColumns, index, direction).map((column, order) => ({ ...column, order }));
    updateSheet({ columns });
  }

  async function save() {
    if (!editing) return;
    setMessage("");
    const response = await fetch("/api/v1/report-templates", { method: editing.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error?.message); return; }
    setMessage("Đã lưu mẫu xuất.");
    setEditing(undefined);
    await load();
  }

  return <ReportPageTemplate>
    {message ? <p className="save-feedback">{message}</p> : null}
    <DataSurface><DataTable actions={(item) => <DropdownMenu label={`Thao tác mẫu ${item.name}`}><button onClick={() => edit(item)} type="button"><Pencil size={16}/>Sửa</button><button onClick={() => edit(item, true)} type="button"><Copy size={16}/>Nhân bản</button></DropdownMenu>} columns={templateColumns} data={templates} emptyDescription="" emptyTitle="Chưa có mẫu xuất" getRowId={(item) => item.id} /></DataSurface>
    {editing ? <Card><form className="leave-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="form-grid"><label>Mã mẫu<input className="input" value={editing.code} onChange={event => setEditing({ ...editing, code: event.target.value.toUpperCase() })}/></label><label>Tên mẫu<input className="input" value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })}/></label></div>
      <label className="choice-field"><input className="checkbox" type="checkbox" checked={editing.active} onChange={event => setEditing({ ...editing, active: event.target.checked })}/>Đang dùng</label>
      <div className="template-sheet-grid"><div className="template-sheet-list">{editing.definition.sheets.map((item, index) => <div className={index === activeSheet ? "is-active" : ""} key={item.key}><button type="button" onClick={() => setActiveSheet(index)}>{item.name}</button><button aria-label="Đưa lên" className="icon-button" type="button" onClick={() => { updateSheets(move(editing.definition.sheets, index, -1)); setActiveSheet(Math.max(0, index - 1)); }}><ArrowUp size={15}/></button><button aria-label="Đưa xuống" className="icon-button" type="button" onClick={() => { updateSheets(move(editing.definition.sheets, index, 1)); setActiveSheet(Math.min(editing.definition.sheets.length - 1, index + 1)); }}><ArrowDown size={15}/></button></div>)}</div>
        {sheet ? <div className="template-column-editor"><div className="form-grid"><label>Tên trang tính<input className="input" maxLength={31} value={sheet.name} onChange={event => updateSheet({ name: event.target.value })}/></label><label className="choice-field"><input className="checkbox" type="checkbox" checked={sheet.enabled} onChange={event => updateSheet({ enabled: event.target.checked })}/>Bật trang tính</label></div><div className="template-column-list">{orderedColumns.map((column, index) => <div key={column.key}><input aria-label={`Bật ${column.label}`} className="checkbox" type="checkbox" checked={column.enabled} onChange={event => updateSheet({ columns: orderedColumns.map(item => item.key === column.key ? { ...item, enabled: event.target.checked } : item) })}/><code>{column.key}</code><input aria-label={`Nhãn ${column.key}`} className="input" value={column.label} onChange={event => updateSheet({ columns: orderedColumns.map(item => item.key === column.key ? { ...item, label: event.target.value } : item) })}/><button aria-label="Đưa cột lên" className="icon-button" type="button" onClick={() => moveColumn(index, -1)}><ArrowUp size={15}/></button><button aria-label="Đưa cột xuống" className="icon-button" type="button" onClick={() => moveColumn(index, 1)}><ArrowDown size={15}/></button></div>)}</div></div> : null}
      </div>
      <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setPreview(value => !value)}><Eye size={16}/>Xem trước</button><button className="button button--secondary" type="button" onClick={() => setEditing(undefined)}>Hủy</button><button className="button button--primary">Lưu mẫu</button></div>
      {preview ? <div className="template-preview">{editing.definition.sheets.filter(item => item.enabled).map(item => <section key={item.key}><strong>{item.name}</strong><div>{[...(item.columns ?? [])].filter(column => column.enabled).sort((a, b) => a.order - b.order).map(column => <span key={column.key}>{column.label}</span>)}</div></section>)}</div> : null}
    </form></Card> : null}
    <DataSurface><header className="data-surface__toolbar"><h3 className="section-title">Lịch sử xuất</h3></header><DataTable actions={(item) => item.status === "completed" ? <DropdownMenu label={`Thao tác tệp ${item.fileName || item.id}`}><FileDownloadLink format="xlsx" href={`/api/v1/report-exports/${item.id}/download`}>Tải xuống</FileDownloadLink></DropdownMenu> : null} columns={exportColumns} data={exports} emptyDescription="" emptyTitle="Chưa có tệp xuất" getRowId={(item) => item.id} /></DataSurface>
  </ReportPageTemplate>;
}
