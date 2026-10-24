"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { SearchInput, Select, Textarea } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { can } from "@/lib/auth/permissions";
import { trialCompanySizes, trialIndustries, trialStatusLabels, trialTransitions, type TrialRequestRecord, type TrialStatus } from "./trialSchemas";
import styles from "./TrialRequests.module.css";

export function TrialRequestsPage() {
  const router=useRouter();const conversion=useRef<{requestId:string;customerId:string}|null>(null);
  const user=useCurrentUser(); const canManage=can(user.permissions,"trial_request.manage");
  const [requests,setRequests]=useState<TrialRequestRecord[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const [query,setQuery]=useState(""); const [statusFilter,setStatusFilter]=useState("all");
  const [page,setPage]=useState(1);const [total,setTotal]=useState(0);
  const [selected,setSelected]=useState<TrialRequestRecord|null>(null);
  const [status,setStatus]=useState("contacted"); const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false); const [locked,setLocked]=useState(false); const [saveError,setSaveError]=useState<string|null>(null);
  const inFlight=useRef(false);
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true); setError(null);
    try { const params=new URLSearchParams({page:String(page),q:query,status:statusFilter==="all"?"":statusFilter});const response=await fetch(`/api/v1/trial-requests?${params}`,{cache:"no-store",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15_000)]):AbortSignal.timeout(15_000)}); const body=await response.json();
      if (!response.ok || body.ok!==true || !Array.isArray(body.data?.requests)) throw new Error("Unavailable leads");
      if (!signal?.aborted) {setRequests(body.data.requests);setTotal(body.data.total??body.data.requests.length);}
    } catch { if (!signal?.aborted) setError("Không thể tải yêu cầu dùng thử. Vui lòng thử lại."); }
    finally { if (!signal?.aborted) setLoading(false); }
  },[page,query,statusFilter]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{if(!controller.signal.aborted)void load(controller.signal);},250); return()=>{clearTimeout(timer);controller.abort();};},[load]);
  function open(record:TrialRequestRecord) { if(inFlight.current)return;setSelected(record);setStatus(trialTransitions[record.status][0]||"closed");setReason("");setSaveError(null);setLocked(false); }
  async function convert(){
    if(!selected||inFlight.current||locked)return;
    if(conversion.current?.requestId!==selected.requestId)conversion.current={requestId:selected.requestId,customerId:crypto.randomUUID()};
    inFlight.current=true;setBusy(true);setSaveError(null);
    try{const response=await fetch("/api/v1/crm/convert-trial",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...conversion.current,rowVersion:selected.rowVersion}),signal:AbortSignal.timeout(20000)});const b=await response.json();if(!response.ok||!b.ok||!b.data?.customerId){setSaveError(b.error?.message||"Chưa thể chuyển hồ sơ. Tải lại yêu cầu.");setLocked(response.status!==400);return;}router.push(`/control-center/customers/${b.data.customerId}`);}catch{setLocked(true);setSaveError("Chưa xác định được kết quả. Tải lại yêu cầu trước khi tiếp tục.");}finally{inFlight.current=false;setBusy(false);}
  }
  async function review(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || inFlight.current || locked)return;
    inFlight.current=true;setBusy(true);setSaveError(null);
    try { const response=await fetch(`/api/v1/trial-requests/${selected.requestId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({rowVersion:selected.rowVersion,status,reason}),signal:AbortSignal.timeout(20_000)});const body=await response.json();
      if(!response.ok||body.ok!==true){setSaveError(body.error?.message||"Chưa xác nhận kết quả. Tải lại yêu cầu trước khi tiếp tục.");if(response.status!==400)setLocked(true);return;}
      if(body.data?.requestId!==selected.requestId||body.data?.rowVersion!==selected.rowVersion+1||body.data?.status!==status)throw new Error("Unconfirmed receipt");
      setSelected(null);setReason("");await load();
    }catch{setLocked(true);setSaveError("Chưa xác định được kết quả lưu. Tải lại yêu cầu trước khi tiếp tục.");}
    finally{inFlight.current=false;setBusy(false);}
  }
  const shown=requests;
  const columns:DataTableColumn<TrialRequestRecord>[]=[
    {id:"company",header:"Doanh nghiệp",priority:"primary",accessor:"companyName"},
    {id:"contact",header:"Người liên hệ",cell:r=><div className={styles.contact}><span>{r.contactName}</span><a href={`mailto:${r.email}`} title={r.email}>{r.email}</a><a href={`tel:${r.phone.replace(/[^+\d]/g,"")}`}>{r.phone}</a></div>},
    {id:"industry",header:"Lĩnh vực",cell:r=>trialIndustries[r.industry]},
    {id:"status",header:"Trạng thái",cell:r=><StatusBadge tone={r.status==="new"?"warning":r.status==="qualified"?"success":"neutral"}>{trialStatusLabels[r.status]}</StatusBadge>},
    {id:"createdAt",header:"Tiếp nhận",cell:r=>new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(r.createdAt))}
  ];
  return <AdminPage title="Yêu cầu dùng thử" actions={<Button disabled={loading||busy} onClick={()=>void load()}>Làm mới</Button>}>
    <div className={styles.filters}><SearchInput label="Tìm doanh nghiệp" onChange={e=>{setQuery(e.target.value);setPage(1);}} value={query}/><Select label="Trạng thái" onChange={e=>{setStatusFilter(e.target.value);setPage(1);}} options={[{value:"all",label:"Tất cả trạng thái"},...Object.entries(trialStatusLabels).map(([value,label])=>({value,label}))]} value={statusFilter}/><span>{total} yêu cầu · Trang {page}/{Math.max(1,Math.ceil(total/25))}</span></div>
    <DataTable actions={r=><Button disabled={busy} onClick={()=>open(r)} size="sm">Xem</Button>} ariaLabel="Yêu cầu dùng thử" className={styles.list} columns={columns} data={shown} emptyTitle="Không có yêu cầu phù hợp" error={error||undefined} getRowId={r=>r.requestId} loading={loading}/>
    <div className={styles.filters}><Button disabled={page===1||loading||busy} onClick={()=>setPage(v=>v-1)}>Trước</Button><Button disabled={page*25>=total||loading||busy} onClick={()=>setPage(v=>v+1)}>Sau</Button></div>
    <Drawer open={selected!==null} onClose={()=>{if(!inFlight.current)setSelected(null);}} title="Chi tiết yêu cầu dùng thử">
      {selected?<div className="overlay-form"><dl className={styles.details}>{[["Doanh nghiệp",selected.companyName],["Người liên hệ",selected.contactName],["Email",selected.email],["Điện thoại",selected.phone],["Lĩnh vực",trialIndustries[selected.industry]],["Quy mô",trialCompanySizes[selected.companySize]],["Nhu cầu",selected.needs||"Chưa cung cấp"],["Trạng thái",trialStatusLabels[selected.status]],["Ghi nhận gần nhất",selected.reviewNote||"Chưa xử lý"],["Mã yêu cầu",selected.requestId]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {selected.qualification?<dl className={styles.details}>{[["Chức vụ",selected.qualification.contactRole],["Tỉnh / thành phố",selected.qualification.province],["Địa chỉ",selected.qualification.address],["Mã số thuế",selected.qualification.taxCode||"—"],["Chi nhánh / công trường",String(selected.qualification.branchCount)],["Công cụ hiện tại",selected.qualification.currentTools||"—"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:null}
      {saveError?<div className="form-alert form-alert--error" role="alert">{saveError}</div>:null}
      {locked?<Button onClick={()=>{setSelected(null);void load();}}>Tải lại yêu cầu</Button>:null}
      {selected.customerId?<Link className="button button--primary button--md" href={`/control-center/customers/${selected.customerId}`}>Mở hồ sơ triển khai</Link>:selected.status==="qualified"&&canManage&&can(user.permissions,"crm.manage")?<Button variant="primary" busy={busy} disabled={busy||locked} onClick={()=>void convert()}>Chuyển sang hồ sơ khách hàng</Button>:null}
      {canManage&&trialTransitions[selected.status].length?<form className="overlay-form" onSubmit={review}><Select disabled={busy||locked} label="Chuyển trạng thái" onChange={e=>setStatus(e.target.value as TrialStatus)} options={trialTransitions[selected.status].map(value=>({value,label:trialStatusLabels[value]}))} value={status}/><Textarea disabled={busy||locked} label="Ghi nhận xử lý" maxLength={500} minLength={3} onChange={e=>setReason(e.target.value)} required value={reason}/><footer><Button busy={busy} disabled={busy||locked} type="submit" variant="primary">Cập nhật</Button></footer></form>:null}</div>:null}
    </Drawer>
  </AdminPage>;
}
