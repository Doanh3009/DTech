"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/shared/Button";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BusinessLink as Link } from "./BusinessLink";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";

type Entry={id:string;kind:"safety_incidents"|"quality_nonconformances";code:string;name:string;state:string;date:string};
type Overdue={id:string;code:string;name:string;dueOn:string;state:string};
type Trend={month:string;incidents:number;critical:number;nonconformances:number};
type Snapshot={asOf:string;totals:{incidents:number;openIncidents:number;workStopped:number;criticalOpen:number;openNonconformances:number;overdueActions:number};incidentSeverity:Record<string,number>;qualitySeverity:Record<string,number>;recent:Entry[];overdue:Overdue[];trend:Trend[];trendPeriodMonths:number};
const labels:Record<Entry["kind"],string>={safety_incidents:"Sự cố an toàn",quality_nonconformances:"Điểm không phù hợp"};
const incidentSeverityLabels:Record<string,string>={near_miss:"Suýt xảy ra",minor:"Nhẹ",serious:"Nghiêm trọng",critical:"Đặc biệt nghiêm trọng"};
const qualitySeverityLabels:Record<string,string>={minor:"Nhẹ",major:"Lớn",critical:"Nghiêm trọng"};
const metricLabels:[keyof Snapshot["totals"],string][]=[["incidents","Tổng sự cố"],["openIncidents","Sự cố đang xử lý"],["workStopped","Có dừng công việc"],["criticalOpen","Mức nghiêm trọng đang mở"],["openNonconformances","Điểm không phù hợp đang mở"],["overdueActions","CAPA quá hạn"]];
function dateLabel(value:string){return new Date(`${value}T12:00:00+07:00`).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});}
export function BusinessQualityWorkspace({workspace:w}:{workspace:BusinessWorkspace}){
 const [data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/quality/dashboard`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không tải được báo cáo chất lượng và an toàn.");if(!c.signal.aborted)setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không tải được báo cáo chất lượng và an toàn.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,revision]);
 return <div className={styles.stack}><PageHeader title="Chất lượng & an toàn" action={<Button disabled={loading} onClick={()=>{setError("");setLoading(true);setRevision(v=>v+1);}}>Cập nhật</Button>}/>
  <section className={styles.overviewMetrics} aria-label="Tổng hợp chất lượng và an toàn">{metricLabels.map(([key,label])=><div className={styles.severityRow} key={key}><span>{label}</span><strong>{loading||error?"—":data?.totals[key].toLocaleString("vi-VN")??"0"}</strong></div>)}</section>
  {error?<p role="alert">{error}</p>:null}
  <section className={styles.progressSurface} aria-label="Phân bố mức độ"><h2>Mức độ</h2><div className={styles.severityGrid}>{[["Sự cố an toàn",data?.incidentSeverity,incidentSeverityLabels],["Điểm không phù hợp",data?.qualitySeverity,qualitySeverityLabels]].map(([title,values,names])=>{const rows=Object.entries((values??{}) as Record<string,number>),max=Math.max(1,...rows.map(([,count])=>count));return <div className={styles.severityGroup} key={String(title)}><strong>{String(title)}</strong>{Object.entries(names as Record<string,string>).map(([key,label])=><div key={key}><span>{label}</span><progress max={max} value={(values as Record<string,number>|undefined)?.[key]??0} aria-label={`${label} · ${(values as Record<string,number>|undefined)?.[key]??0}`}/><b>{((values as Record<string,number>|undefined)?.[key]??0).toLocaleString("vi-VN")}</b></div>)}</div>;})}</div></section>
  <section className={styles.progressSurface} aria-label="Hồ sơ sự cố và điểm không phù hợp"><h2>Hồ sơ gần đây</h2><DataTable<Entry> loading={loading} error={error} data={data?.recent??[]} getRowId={r=>r.id} emptyTitle="Chưa có hồ sơ" columns={[{id:"code",header:"Mã",priority:"primary",cell:r=><Link prefetch={false} href={`/erp/${w.slug}/${r.kind}?q=${encodeURIComponent(r.code)}`}>{r.code}</Link>},{id:"name",header:"Tên",accessor:"name"},{id:"kind",header:"Loại",cell:r=>labels[r.kind]},{id:"date",header:"Ngày ghi nhận",cell:r=>dateLabel(r.date)},{id:"state",header:"Trạng thái",cell:r=><StatusBadge tone={r.state==="posted"?"success":r.state==="cancelled"?"warning":"info"}>{r.state==="posted"?"Đã ghi nhận":r.state==="cancelled"?"Đã hủy":"Đang xử lý"}</StatusBadge>}]}/></section>
  <section className={styles.progressSurface} aria-label="Xu hướng chất lượng và an toàn"><h2>Xu hướng 12 tháng</h2><DataTable<Trend> loading={loading} error={error} data={data?.trend??[]} getRowId={r=>r.month} emptyTitle="Chưa có dữ liệu" columns={[{id:"month",header:"Tháng",priority:"primary",accessor:"month"},{id:"incidents",header:"Sự cố",cell:r=>r.incidents.toLocaleString("vi-VN")},{id:"critical",header:"Nghiêm trọng",cell:r=>r.critical.toLocaleString("vi-VN")},{id:"nonconformances",header:"Không phù hợp",cell:r=>r.nonconformances.toLocaleString("vi-VN")}]} /></section>
  <section className={styles.progressSurface} aria-label="CAPA quá hạn"><h2>CAPA quá hạn</h2><DataTable<Overdue> loading={loading} error={error} data={data?.overdue??[]} getRowId={r=>r.id} emptyTitle="Không có CAPA quá hạn" columns={[{id:"code",header:"Mã",priority:"primary",cell:r=><Link prefetch={false} href={`/erp/${w.slug}/corrective_actions?q=${encodeURIComponent(r.code)}`}>{r.code}</Link>},{id:"name",header:"Tên",accessor:"name"},{id:"dueOn",header:"Hạn xử lý",cell:r=>dateLabel(r.dueOn)},{id:"state",header:"Trạng thái",cell:r=><StatusBadge tone="warning">{r.state==="draft"?"Bản nháp":"Đang xử lý"}</StatusBadge>}]}/></section>
  <span className={styles.user}>Cập nhật đến {data?dateLabel(data.asOf):"—"}</span>
 </div>;
}
