"use client";

import { downloadFile } from "@/lib/files/downloadFile";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { Input, SearchInput, Select } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { WorkflowSteps } from "@/components/shared/WorkflowSteps";
import { reconcileTimesheet } from "../services/timesheetPresentation";
import styles from "./TimesheetPeriodDetail.module.css";
import formStyles from "./TimesheetForms.module.css";
import { DataSurface, DetailPageLayout } from "@/components/shared/PageLayouts";
import { EntityContextHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContextTabs } from "@/components/shared/Tabs";
import { LoadingState, ErrorState } from "@/components/shared/States";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import type { DailyTimesheet, ReportTemplate, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";
import { formatBusinessDate } from "@/lib/time/timezone";

type Detail = { period: TimesheetPeriod; summaries: TimesheetSummary[]; daily: DailyTimesheet[]; openHighExceptionCount?: number };
type Props = {
  periodId: string; employeeId?: string; canAdjust?: boolean; canExport?: boolean;
  canLock?: boolean; canRecompute?: boolean; canUnlock?: boolean; canViewExceptions?: boolean; canTransferPayroll?: boolean;
};
const labels: Record<string, string> = {
  open: "Mở", reviewing: "Đang rà soát", locked: "Đã khóa", reopened: "Đã mở lại",
  full_work: "Đủ công", late: "Đi trễ", early_leave: "Về sớm", missing_check_in: "Thiếu vào",
  missing_check_out: "Thiếu ra", annual_leave: "Phép năm", unpaid_leave: "Nghỉ không lương",
  absent: "Vắng", business_trip: "Công tác", holiday: "Ngày lễ", rest_day: "Ngày nghỉ",
  worker_site: "Công trường", needs_review: "Cần rà soát"
};
const displayTime = (value?: string) => value ? new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";

export function TimesheetPeriodDetail({ periodId, employeeId, canAdjust = false, canExport = false, canLock = false, canRecompute = false, canUnlock = false, canViewExceptions = false }: Props) {
  const mutationRef = useRef(false);
  const [detail, setDetail] = useState<Detail>();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [tab, setTab] = useState<"summary" | "daily">(employeeId ? "daily" : "summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [employeeGroup, setEmployeeGroup] = useState<"all" | "office" | "worker">("all");
  const [search,setSearch]=useState(""),[dateFilter,setDateFilter]=useState(""),[page,setPage]=useState(0),[unlockOpen,setUnlockOpen]=useState(false),[unlockReason,setUnlockReason]=useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/timesheet-periods/${periodId}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = await response.json() as { data?: Detail; error?: { message: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải kỳ công.");
    setDetail(body.data);
    setError("");
  }, [periodId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải kỳ công."));
      if (canExport) void fetch("/api/v1/report-templates").then((response) => response.json()).then((body: { data?: ReportTemplate[] }) => {
        const items = (body.data ?? []).filter((item) => item.reportType === "timesheet");
        setTemplates(items);
        setTemplateId(items[0]?.id ?? "");
      }).catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canExport, load]);
  useDomainReconciliation("timesheets", load);

  const matchesEmployeeGroup = useCallback((employmentTypeName: string) => {
    if (employeeGroup === "all") return true;
    const isWorker = /công nhân|công trường/i.test(employmentTypeName);
    return employeeGroup === "worker" ? isWorker : !isWorker;
  }, [employeeGroup]);
  const daily = useMemo(() => detail?.daily.filter((item) => (!employeeId || item.employeeId === employeeId) && matchesEmployeeGroup(item.employmentTypeName) && (!dateFilter||item.workDate===dateFilter) && `${item.employeeName} ${item.employeeCode}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))) ?? [], [detail, employeeId, matchesEmployeeGroup,dateFilter,search]);
  const summaries = useMemo(() => detail?.summaries.filter((item) => (!employeeId || item.employeeId === employeeId) && matchesEmployeeGroup(item.employmentTypeName) && `${item.employeeName} ${item.employeeCode}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))) ?? [], [detail, employeeId, matchesEmployeeGroup,search]);

  async function action(kind: "recompute" | "lock" | "unlock") {
    if (!detail || mutationRef.current) return;
    let payload: Record<string, unknown> = { rowVersion: detail.period.rowVersion };
    if (kind === "unlock") {
      if (unlockReason.trim().length<3) return;
      payload = { ...payload, reason: unlockReason.trim() };
    }
    mutationRef.current=true;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/timesheet-periods/${periodId}/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000), body: JSON.stringify(payload) });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể cập nhật kỳ công.");
      await load();
      setUnlockOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật kỳ công.");
    } finally { mutationRef.current=false;setBusy(false); }
  }

  async function exportExcel() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/report-exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId, periodId }) });
      const body = await response.json() as { data?: { id: string }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể xuất tệp.");
      await downloadFile(`/api/v1/report-exports/${body.data.id}/download`, { format: "xlsx" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất tệp.");
    } finally { setBusy(false); }
  }

  if (!detail) return error ? <ErrorState description={error} /> : <LoadingState title="Đang tải kỳ công" />;
  const period = detail.period;
  const byEmployee=new Map<string,DailyTimesheet[]>();for(const item of detail.daily){const rows=byEmployee.get(item.employeeId)??[];rows.push(item);byEmployee.set(item.employeeId,rows);}
  const mismatches=detail.summaries.filter(item=>reconcileTimesheet(item,byEmployee.get(item.employeeId)??[]).mismatch||!(byEmployee.get(item.employeeId)?.length));
  const rows=tab==="daily"?daily:summaries,currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/50)-1));
  const summaryColumns: DataTableColumn<TimesheetSummary>[] = [
    { id: "employee", header: "Nhân viên", priority: "primary", cell: (item) => <strong>{item.employeeName}</strong> },
    { id: "scheduled", header: "Ngày chuẩn", cell: (item) => String(item.scheduledWorkdays) },
    { id: "actual", header: "Ngày công", cell: (item) => String(item.actualWorkdays) },
    { id: "late", header: "Trễ", cell: (item) => `${item.lateDays} / ${item.lateMinutes}'`, hiddenOnMobile: true },
    { id: "leave", header: "Phép năm", cell: (item) => String(item.annualLeaveDays), hiddenOnMobile: true },
    { id: "absent", header: "Vắng", cell: (item) => String(item.absentDays) },
    { id: "exception", header: "Ngoại lệ", cell: (item) => String(item.exceptionCount) }
  ];
  const dailyColumns: DataTableColumn<DailyTimesheet>[] = [
    { id: "date", header: "Ngày", cell: (item) => formatBusinessDate(item.workDate) },
    ...(!employeeId ? [{ id: "employee", header: "Nhân viên", priority: "primary" as const, cell: (item: DailyTimesheet) => <>{item.employeeName}</> }] : []),
    { id: "shift", header: "Ca", cell: (item) => item.shiftName || "—" },
    { id: "in", header: "Vào", cell: (item) => displayTime(item.effectiveCheckIn) },
    { id: "out", header: "Ra", cell: (item) => displayTime(item.effectiveCheckOut) },
    { id: "fraction", header: "Công", cell: (item) => String(item.workFraction) },
    { id: "late", header: "Trễ", cell: (item) => `${item.lateMinutes}'`, hiddenOnMobile: true },
    { id: "status", header: "Trạng thái", cell: (item) => <StatusBadge tone={item.exceptionCount ? "warning" : "neutral"}>{labels[item.status] ?? item.status}</StatusBadge> }
  ];
  return <DetailPageLayout className="timesheet-period-page">
    <EntityContextHeader
      action={<>
        {period.status !== "locked" && canRecompute ? <Button disabled={busy} onClick={() => void action("recompute")} variant="secondary">Tính lại</Button> : null}
        {period.status !== "locked" && canLock ? <Button disabled={busy||!detail.summaries.length||mismatches.length>0||Boolean(detail.openHighExceptionCount)} onClick={() => void action("lock")} variant="primary">Chốt kỳ công</Button> : null}
        {period.status === "locked" && canUnlock ? <Button disabled={busy} onClick={() => setUnlockOpen(true)} variant="secondary">Mở khóa</Button> : null}
        <Link className="button button--secondary button--md" href="/timesheets/matrix">Bảng công tháng</Link>
        {canExport ? <>
          <Select label="Mẫu xuất" labelHidden onChange={(event) => setTemplateId(event.target.value)} options={templates.map((item) => ({ label: item.name, value: item.id }))} value={templateId} />
          <Button disabled={busy || !templateId} onClick={() => void exportExcel()} variant="secondary" busy={busy}>{"Xuất Excel"}</Button>
        </> : null}
      </>}
      code="Kỳ công"
      meta={<><span>{formatBusinessDate(period.startDate)} – {formatBusinessDate(period.endDate)}</span><StatusBadge tone={period.status === "locked" ? "success" : "warning"}>{labels[period.status]}</StatusBadge><span>Phiên bản {period.version}</span></>}
      title={period.name}
    />
    <WorkflowSteps label="Quy trình chốt công" steps={["Thu thập công","Rà soát / điều chỉnh","Chốt kỳ công"]} current={period.status==="locked"?2:period.status==="open"?0:1} completed={period.status === "locked"}/>
    <dl className={styles.metrics}><div><dt>Nhân viên</dt><dd>{summaries.length}</dd></div><div><dt>Công thực tế</dt><dd>{Number(summaries.reduce((sum,item)=>sum+item.actualWorkdays,0).toFixed(2))}</dd></div><div><dt>Phép năm</dt><dd>{summaries.reduce((sum,item)=>sum+item.annualLeaveDays,0)}</dd></div><div><dt>Muộn / sớm</dt><dd>{summaries.reduce((sum,item)=>sum+item.lateDays+item.earlyLeaveDays,0)}</dd></div></dl>
    {mismatches.length?<div className={styles.warning} role="status">{mismatches.length} hồ sơ thiếu chi tiết ngày hoặc lệch tổng công</div>:null}
    {detail.openHighExceptionCount?<div className={styles.warning} role="status">{detail.openHighExceptionCount} ngoại lệ nghiêm trọng chưa xử lý {canViewExceptions?<Link href={`/timesheets/exceptions?periodId=${periodId}`}>Mở ngoại lệ</Link>:null}</div>:null}
    {error && !unlockOpen ? <p className="form-error" role="alert">{error}</p> : null}
    <DataSurface className="operational-workspace">
      <div className="operational-workspace__toolbar">
        <ContextTabs
          items={[
            { label: `Tổng hợp (${summaries.length})`, active: tab === "summary", onSelect: () => {setTab("summary");setPage(0);} },
            { label: `Chi tiết (${daily.length})`, active: tab === "daily", onSelect: () => {setTab("daily");setPage(0);} },
            ...(canViewExceptions ? [{ label: "Ngoại lệ", href: `/timesheets/exceptions?periodId=${periodId}` }] : [])
          ]}
          label="Dữ liệu kỳ công"
        />
        {!employeeId ? <Select label="Nhóm nhân viên" labelHidden name="employeeGroup" onChange={(event) => setEmployeeGroup(event.target.value as "all" | "office" | "worker")} options={[{ value: "all", label: "Tất cả nhân viên" }, { value: "office", label: "Nhân viên văn phòng" }, { value: "worker", label: "Công nhân" }]} value={employeeGroup} /> : null}
      </div>
      <div className={styles.filters} data-ui="filter-controls"><SearchInput aria-label="Tìm nhân viên trong kỳ công" placeholder="Tìm nhân viên" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/>{tab==="daily"?<Input label="Ngày công" labelHidden type="date" min={period.startDate} max={period.endDate} value={dateFilter} onChange={event=>{setDateFilter(event.target.value);setPage(0);}}/>:null}{dateFilter?<Button onClick={()=>setDateFilter("")}>Tất cả ngày</Button>:null}</div>
      {tab === "summary" ? <DataTable columns={summaryColumns} data={summaries.slice(currentPage*50,currentPage*50+50)} emptyDescription="" emptyTitle="Chưa có tổng hợp" getRowId={(item) => item.employeeId} rowHrefPrefix={`/timesheets/periods/${periodId}/employees/`} /> : <DataTable actions={period.status !== "locked" && canAdjust ? (item) => <DropdownMenu label={`Thao tác công ${item.employeeName}`}><Link href={`/timesheets/adjustments?periodId=${periodId}&employeeId=${item.employeeId}&date=${item.workDate}&rowVersion=${period.rowVersion}`}>Điều chỉnh</Link></DropdownMenu> : undefined} columns={dailyColumns} data={daily.slice(currentPage*50,currentPage*50+50)} emptyDescription="" emptyTitle="Chưa có dữ liệu ngày công" getRowId={(item) => item.id} />}
      {rows.length>50?<div className={styles.pagination}><span>{currentPage*50+1}–{Math.min(rows.length,currentPage*50+50)} / {rows.length}</span><Button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Trước</Button><Button disabled={currentPage*50+50>=rows.length} onClick={()=>setPage(currentPage+1)}>Tiếp</Button></div>:null}
    </DataSurface>
    <Drawer title="Mở lại kỳ công" open={unlockOpen} onClose={()=>setUnlockOpen(false)}><form className={`drawer-form ${formStyles.stack}`} onSubmit={event=>{event.preventDefault();void action("unlock");}}><Input label="Lý do mở lại" value={unlockReason} onChange={event=>setUnlockReason(event.target.value)} minLength={3} maxLength={500} required/>{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button disabled={busy} onClick={()=>setUnlockOpen(false)} type="button">Hủy</Button><Button busy={busy} variant="primary" disabled={busy||unlockReason.trim().length<3} type="submit">Mở lại kỳ công</Button></div></form></Drawer>
  </DetailPageLayout>;
}
