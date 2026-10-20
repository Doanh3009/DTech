"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { DataSurface, FormPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatBusinessDate } from "@/lib/time/timezone";
import type { TimesheetAdjustment, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";
import { dailyLabels } from "../services/timesheetPresentation";
import styles from "./TimesheetForms.module.css";

const adjustmentLabels = {
  add_missing_check_in: "Bổ sung chấm vào", add_missing_check_out: "Bổ sung chấm ra", adjust_effective_time: "Sửa giờ vào / ra",
  mark_leave: "Ghi nhận nghỉ phép", mark_business_trip: "Ghi nhận công tác", correct_status: "Điều chỉnh trạng thái",
  correct_work_fraction: "Điều chỉnh ngày công", note_only: "Ghi nhận nhân sự"
};
const columns: DataTableColumn<TimesheetAdjustment>[] = [
  { id: "date", header: "Ngày công", cell: item => formatBusinessDate(item.workDate) },
  { id: "type", header: "Điều chỉnh", priority: "primary", cell: item => adjustmentLabels[item.adjustmentType as keyof typeof adjustmentLabels] ?? item.adjustmentType },
  { id: "reason", header: "Lý do", accessor: "reason" },
  { id: "time", header: "Ghi nhận lúc", cell: item => new Date(item.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }), hiddenOnMobile: true }
];
export function TimesheetAdjustmentForm({ defaults }: { defaults: { periodId?: string; employeeId?: string; date?: string; rowVersion?: string } }) {
  const [periods,setPeriods]=useState<TimesheetPeriod[]>([]),[periodId,setPeriodId]=useState(defaults.periodId??"");
  const [period,setPeriod]=useState<TimesheetPeriod>(),[employees,setEmployees]=useState<TimesheetSummary[]>([]);
  const [employeeId,setEmployeeId]=useState(defaults.employeeId??""),[workDate,setWorkDate]=useState(defaults.date??"");
  const [kind,setKind]=useState<keyof typeof adjustmentLabels>("add_missing_check_in"),[history,setHistory]=useState<TimesheetAdjustment[]>([]);
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  const submitting=useRef(false);
  const loadPeriod=useCallback(async(signal?:AbortSignal)=>{
    if(!periodId)return;
    const response=await fetch(`/api/v1/timesheet-periods/${periodId}`,{signal:signal??AbortSignal.timeout(20_000),cache:"no-store"}),body=await response.json();
    if(!response.ok)throw new Error(body.error?.message??"Không thể đọc kỳ công.");
    setPeriod(body.data.period);setEmployees(body.data.summaries??[]);
  },[periodId]);
  const loadHistory=useCallback(async()=>{
    if(!periodId||!employeeId)return;
    const query=new URLSearchParams({employeeId});if(workDate)query.set("date",workDate);
    const response=await fetch(`/api/v1/timesheet-periods/${periodId}/adjustments?${query}`,{signal:AbortSignal.timeout(20_000)}),body=await response.json();
    if(!response.ok)throw new Error(body.error?.message??"Không thể đọc lịch sử điều chỉnh.");setHistory(body.data??[]);
  },[periodId,employeeId,workDate]);
  useEffect(()=>{const controller=new AbortController();void fetch("/api/v1/timesheet-periods",{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error?.message);setPeriods(body.data??[]);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{setLoading(true);void loadPeriod(controller.signal).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},0);return()=>{clearTimeout(timer);controller.abort();};},[loadPeriod]);
  useEffect(()=>{const timer=setTimeout(()=>void loadHistory().catch(reason=>setError(reason.message)),0);return()=>clearTimeout(timer);},[loadHistory]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(submitting.current||!period||period.status==="locked")return;
    submitting.current=true;setBusy(true);setError("");setMessage("");const form=new FormData(event.currentTarget);
    const effective=String(form.get("effectiveTime")??"");
    try{
      const response=await fetch(`/api/v1/timesheet-periods/${periodId}/adjustments`,{method:"POST",headers:{"content-type":"application/json"},signal:AbortSignal.timeout(60_000),body:JSON.stringify({employeeId,workDate,adjustmentType:kind,rowVersion:period.rowVersion,
        effectiveTime:effective?new Date(`${effective}:00+07:00`).toISOString():undefined,timeTarget:form.get("timeTarget")||undefined,
        correctedStatus:form.get("correctedStatus")||undefined,correctedWorkFraction:form.get("correctedWorkFraction")!==null&&form.get("correctedWorkFraction")!==""?Number(form.get("correctedWorkFraction")):undefined,
        reason:form.get("reason"),hrNote:form.get("hrNote")||undefined})}),body=await response.json();
      if(!response.ok)throw new Error(body.error?.message??"Không thể ghi nhận điều chỉnh.");
      setMessage("Đã ghi nhận và tính lại kỳ công");await Promise.all([loadPeriod(),loadHistory()]);
    }catch(reason){setError(reason instanceof Error?reason.message:"Không thể ghi nhận điều chỉnh.");await loadPeriod().catch(()=>{});}
    finally{submitting.current=false;setBusy(false);}
  }
  const needsTime=["add_missing_check_in","add_missing_check_out","adjust_effective_time"].includes(kind);
  return <FormPageLayout><Card><form className={styles.stack} onSubmit={submit}>
    <div className="panel-header timesheet-adjustment-heading"><h2>Thông tin điều chỉnh</h2>{period?<StatusBadge tone={period.status==="locked"?"success":"warning"}>{period.status==="locked"?"Đã chốt":"Đang rà soát"}</StatusBadge>:null}</div>
    <div className="form-grid">
      <Select label="Kỳ công" required placeholder="Chọn kỳ công" value={periodId} onChange={event=>{setPeriodId(event.target.value);setEmployeeId("");setWorkDate("");setPeriod(undefined);setEmployees([]);setHistory([]);setMessage("");}} options={periods.map(item=>({value:item.id,label:item.name}))}/>
      <Select label="Nhân viên" required disabled={loading||!periodId} placeholder="Chọn nhân viên" value={employeeId} onChange={event=>{setEmployeeId(event.target.value);setMessage("");}} options={employees.map(item=>({value:item.employeeId,label:`${item.employeeCode} · ${item.employeeName}`}))}/>
      <Input label="Ngày công" type="date" min={period?.startDate} max={period?.endDate} required value={workDate} onChange={event=>{setWorkDate(event.target.value);setMessage("");}}/>
      <Select label="Điều chỉnh" value={kind} onChange={event=>setKind(event.target.value as keyof typeof adjustmentLabels)} options={Object.entries(adjustmentLabels).map(([value,label])=>({value,label}))}/>
      {needsTime?<Input label="Thời gian hiệu lực" name="effectiveTime" key={`${kind}-${workDate}`} type="datetime-local" defaultValue={workDate?`${workDate}T${kind==="add_missing_check_out"?"17:00":"08:00"}`:undefined} required/>:null}
      {kind==="adjust_effective_time"?<Select label="Lượt chấm công" name="timeTarget" options={[{value:"check_in",label:"Chấm vào"},{value:"check_out",label:"Chấm ra"}]}/>:null}
      {kind==="correct_status"||kind==="mark_leave"?<Select label="Trạng thái công" name="correctedStatus" options={Object.entries(dailyLabels).filter(([value])=>kind!=="mark_leave"||["annual_leave","unpaid_leave"].includes(value)).map(([value,label])=>({value,label}))}/>:null}
      {kind==="correct_work_fraction"||kind==="correct_status"?<Input label="Ngày công" name="correctedWorkFraction" min={0} max={1} step="0.01" type="number" required={kind==="correct_work_fraction"}/>:null}
    </div>
    <Textarea label="Lý do điều chỉnh" name="reason" required minLength={3} maxLength={500}/><Textarea label="Ghi nhận nhân sự" name="hrNote" maxLength={1000}/>
    {error?<p className="form-error" role="alert">{error}</p>:null}{message?<StatusBadge tone="success">{message}</StatusBadge>:null}
    <div className="form-actions"><Button busy={busy} disabled={busy||loading||!period||!employeeId||!workDate||period.status==="locked"} variant="primary" type="submit">Lưu điều chỉnh</Button></div>
  </form></Card><DataSurface><header className="data-surface__toolbar"><h3>Lịch sử điều chỉnh</h3><span>{history.length}</span></header><DataTable columns={columns} data={history} getRowId={item=>item.id} emptyTitle="Chưa có điều chỉnh" emptyDescription=""/></DataSurface></FormPageLayout>;
}
