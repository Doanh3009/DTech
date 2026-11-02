"use client";
import {useEffect,useState} from "react";
import {BusinessLink as Link} from "./BusinessLink";
import {Button} from "@/components/shared/Button";
import {DataTable} from "@/components/shared/DataTable";
import {StatusBadge} from "@/components/shared/StatusBadge";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
interface Row{id:string;kind:string;kindLabel:string;code:string;name:string;stepName:string;stepIndex:number;dueAt:string;overdue:boolean;submittedAt:string;policyVersion:number}
interface Snapshot{rows:Row[];total:number;page:number;pageSize:number;overdue:number}
interface Report{pending:number;overdue:number;returned30d:number;closed30d:number;averageHours30d:number|null;periodDays:number}
export function BusinessApprovalInbox({workspace:w}:{workspace:BusinessWorkspace}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[report,setReport]=useState<Report|null>(null),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/approval/inbox?page=${page}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không tải được hộp thư duyệt.");if(!c.signal.aborted){setSnapshot(b.data);setError("");}}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không tải được hộp thư duyệt.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,page,revision]);
 useEffect(()=>{if(w.role!=="owner")return;const c=new AbortController();fetch(`/api/v1/business/${w.slug}/approval/report`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không tải được báo cáo duyệt.");if(!c.signal.aborted)setReport(b.data);}).catch(()=>{if(!c.signal.aborted)setReport(null);});return()=>c.abort();},[w.slug,w.role,revision]);
 const date=(value:string)=>new Date(value).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
 return <section className={styles.stack} aria-label="Hộp thư duyệt">
  <div className={styles.collaborationHead}><h2>Hộp thư duyệt</h2><Button disabled={loading} onClick={()=>{setLoading(true);setError("");setRevision(v=>v+1);}}>Cập nhật</Button></div>
  {snapshot?<div className={styles.actions}><StatusBadge tone="neutral">{snapshot.total.toLocaleString("vi-VN")} chờ bạn xử lý</StatusBadge><StatusBadge tone={snapshot.overdue?"warning":"success"}>{snapshot.overdue.toLocaleString("vi-VN")} quá hạn</StatusBadge></div>:null}
  {report?<div className={styles.actions}><StatusBadge tone="neutral">{report.pending.toLocaleString("vi-VN")} tồn đọng</StatusBadge><StatusBadge tone={report.overdue?"warning":"success"}>{report.overdue.toLocaleString("vi-VN")} quá SLA</StatusBadge><StatusBadge tone="neutral">{report.returned30d.toLocaleString("vi-VN")} trả về · 30 ngày</StatusBadge><StatusBadge tone="neutral">{report.closed30d.toLocaleString("vi-VN")} hoàn tất · 30 ngày</StatusBadge><StatusBadge tone="neutral">{report.averageHours30d===null?"—":report.averageHours30d.toLocaleString("vi-VN")} giờ xử lý TB</StatusBadge></div>:null}
  {!loading&&!error&&snapshot?.total===0?<div role="status" className={styles.readOnly}>Không có chứng từ chờ duyệt</div>:<DataTable<Row> className={styles.operationalTable} ariaLabel="Chứng từ chờ duyệt" loading={loading} error={error} data={snapshot?.rows??[]} getRowId={r=>`${r.kind}-${r.id}`} emptyTitle="Không có chứng từ chờ duyệt" columns={[
   {id:"document",header:"Chứng từ",priority:"primary",cell:r=><Link prefetch={false} className={styles.link} href={`/erp/${w.slug}/${r.kind}?q=${encodeURIComponent(r.code)}`}>{r.code} · {r.name}</Link>},
   {id:"kind",header:"Nghiệp vụ",accessor:"kindLabel"},
   {id:"step",header:"Bước duyệt",cell:r=>`${r.stepIndex+1}. ${r.stepName}`},
   {id:"due",header:"Hạn xử lý",cell:r=><StatusBadge tone={r.overdue?"warning":"neutral"}>{date(r.dueAt)}</StatusBadge>},
   {id:"submitted",header:"Trình lúc",cell:r=>date(r.submittedAt)}
  ]}/>}
  {(snapshot?.total??0)>0?<div className={styles.pagination}><span>{snapshot?.total??0} chứng từ · Trang {page}/{Math.max(1,Math.ceil((snapshot?.total??0)/25))}</span><div className={styles.actions}><Button disabled={loading||page<=1} onClick={()=>{setPage(v=>v-1);setLoading(true);setError("");}}>Trước</Button><Button disabled={loading||page*25>=(snapshot?.total??0)} onClick={()=>{setPage(v=>v+1);setLoading(true);setError("");}}>Sau</Button></div></div>:null}
 </section>;
}
