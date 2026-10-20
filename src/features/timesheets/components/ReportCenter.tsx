"use client";

import { downloadFile } from "@/lib/files/downloadFile";

import { useEffect, useState } from "react";
import { Select } from "@/components/shared/FormControls";
import { Card } from "@/components/shared/Card";
import type { ReportTemplate } from "../types/timesheetTypes";

export function ReportCenter() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/v1/report-templates", { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Không thể tải mẫu xuất.");
        const items = (body.data ?? []).filter((item: ReportTemplate) => item.active && item.reportType !== "timesheet");
        setTemplates(items);
        setTemplateId(items[0]?.id ?? "");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Không thể tải mẫu xuất.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  const selected = templates.find((item) => item.id === templateId);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/report-exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateId, employeeId: selected?.reportType === "employee_profile" ? employeeId : undefined }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Không thể xuất báo cáo.");
      await downloadFile(`/api/v1/report-exports/${body.data.id}/download`, { format: "xlsx" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xuất báo cáo.");
    } finally {
      setBusy(false);
    }
  }
  return <Card><form className="leave-form" onSubmit={submit}>
    <Select label="Mẫu báo cáo" className="select" value={templateId} onChange={(event) => setTemplateId(event.target.value)} options={templates.map((item) => ({ label: item.name, value: item.id }))} />
    {selected?.reportType === "employee_profile" ? <label>ID nhân viên<input className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required /></label> : null}
    <div className="form-actions"><button className="button button--primary" disabled={busy || !templateId}>{busy ? "Đang xuất…" : "Xuất Excel"}</button></div>
    {message ? <p className="form-error" role="alert">{message}</p> : null}
  </form></Card>;
}
