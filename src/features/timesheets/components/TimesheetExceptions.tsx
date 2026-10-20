"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { SearchInput, Textarea } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { ContextTabs } from "@/components/shared/Tabs";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import type { TimesheetException } from "../types/timesheetTypes";
import { formatBusinessDate } from "@/lib/time/timezone";
import styles from "./TimesheetForms.module.css";

const labels: Record<string, string> = {
  missing_check_in: "Thiếu chấm vào",
  missing_check_out: "Thiếu chấm ra",
  attendance_leave_conflict: "Trùng đơn nghỉ",
  gps_issue: "GPS",
  photo_pending: "Ảnh chờ đồng bộ",
  offline_sync_pending: "Chờ đồng bộ",
  worker_roster_conflict: "Đội công nhân",
  duplicate_source_conflict: "Trùng nguồn"
};

export function TimesheetExceptions({ periodId, canResolve = false }: { periodId?: string; canResolve?: boolean }) {
  const [items, setItems] = useState<TimesheetException[]>([]);
  const [error, setError] = useState("");
  const [search,setSearch]=useState(""),[status,setStatus]=useState("open"),[resolution,setResolution]=useState<{item:TimesheetException;status:"resolved"|"ignored"}>(),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const mutationRef=useRef(false);
  const load = useCallback(() => fetch(`/api/v1/timesheet-exceptions${periodId ? `?periodId=${periodId}` : ""}`).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message);
    setItems(body.data);setError("");setLoading(false);
  }), [periodId]);

  useEffect(() => { void load().catch((value: Error) => {setError(value.message);setLoading(false);}); }, [load]);
  useDomainReconciliation("timesheets", load);

  async function resolve() {
    if(!resolution||mutationRef.current||note.trim().length<3)return;
    mutationRef.current=true;setBusy(true);setError("");
    try{const response = await fetch(`/api/v1/timesheet-exceptions/${resolution.item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status:resolution.status, note:note.trim() }),signal:AbortSignal.timeout(20_000)
    });
    const body = await response.json();
    if (!response.ok)throw new Error(body.error?.message??"Không thể xử lý ngoại lệ.");
    await load();setResolution(undefined);
    }catch(reason){setError(reason instanceof Error?reason.message:"Không thể xử lý ngoại lệ.");}
    finally{mutationRef.current=false;setBusy(false);}
  }

  const columns = useMemo<DataTableColumn<TimesheetException>[]>(() => [
    { id: "date", header: "Ngày", cell: (item) => formatBusinessDate(item.workDate) },
    { id: "employee", header: "Nhân viên", priority: "primary", cell: (item) => <strong>{item.employeeName}</strong> },
    { id: "type", header: "Loại", cell: (item) => labels[item.type] ?? item.type },
    { id: "severity", header: "Mức độ", cell: (item) => <StatusBadge tone={item.severity === "high" ? "error" : "warning"}>{item.severity === "high" ? "Cao" : "Cảnh báo"}</StatusBadge> },
    { id: "status", header: "Trạng thái", cell: (item) => item.status === "open" ? "Chưa xử lý" : item.status === "resolved" ? "Đã xử lý" : "Đã bỏ qua" }
  ], []);

  return (
    <ListPageLayout>
      <DataSurface>
        <div className="data-surface__toolbar"><ContextTabs label="Trạng thái ngoại lệ" items={[{label:`Cần xử lý (${items.filter(item=>item.status==="open").length})`,active:status==="open",onSelect:()=>setStatus("open")},{label:"Đã xử lý",active:status==="resolved",onSelect:()=>setStatus("resolved")},{label:"Đã bỏ qua",active:status==="ignored",onSelect:()=>setStatus("ignored")}]}/><SearchInput aria-label="Tìm nhân viên có ngoại lệ" placeholder="Tìm nhân viên" value={search} onChange={event=>setSearch(event.target.value)}/></div>
        <DataTable
          actions={(item) => (
            <DropdownMenu label={`Thao tác ngoại lệ ${item.employeeName}`}>
              <Link href={`/timesheets/periods/${item.periodId}/employees/${item.employeeId}?date=${item.workDate}`}>Chi tiết công</Link>
              {canResolve&&item.status==="open"?<><Link href={`/timesheets/adjustments?periodId=${item.periodId}&employeeId=${item.employeeId}&date=${item.workDate}`}>Điều chỉnh công</Link><button onClick={() => {setResolution({item,status:"resolved"});setNote("");}} type="button">Ghi nhận xử lý</button><button onClick={() => {setResolution({item,status:"ignored"});setNote("");}} type="button">Bỏ qua có lý do</button></>:null}
            </DropdownMenu>
          )}
          columns={columns}
          data={items.filter(item=>item.status===status&&`${item.employeeName} ${item.employeeCode}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))}
          loading={loading}
          emptyDescription=""
          emptyTitle="Không có ngoại lệ"
          error={resolution ? undefined : error}
          getRowId={(item) => item.id}
        />
      </DataSurface>
      <Drawer open={Boolean(resolution)} onClose={()=>setResolution(undefined)} title={resolution?.status==="ignored"?"Bỏ qua ngoại lệ":"Ghi nhận xử lý ngoại lệ"}>{resolution?<form className={`drawer-form ${styles.stack}`} onSubmit={event=>{event.preventDefault();void resolve();}}><strong>{resolution.item.employeeName}</strong><StatusBadge tone="warning">{labels[resolution.item.type]} · {formatBusinessDate(resolution.item.workDate)}</StatusBadge><Textarea label={resolution.status==="ignored"?"Lý do bỏ qua":"Kết quả đối chiếu"} value={note} onChange={event=>setNote(event.target.value)} minLength={3} maxLength={500} required/>{error?<p className="form-error" role="alert">{error}</p>:null}<div className="form-actions"><Button disabled={busy} onClick={()=>setResolution(undefined)} type="button">Hủy</Button><Button busy={busy} disabled={busy||note.trim().length<3} type="submit" variant="primary">Lưu kết quả</Button></div></form>:null}</Drawer>
    </ListPageLayout>
  );
}
