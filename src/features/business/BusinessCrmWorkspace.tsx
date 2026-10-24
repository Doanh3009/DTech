"use client";
import {BusinessLink as Link} from "./BusinessLink";
import {useEffect,useState} from "react";
import {Button} from "@/components/shared/Button";
import {DataTable} from "@/components/shared/DataTable";
import {PageHeader} from "@/components/shared/PageHeader";
import {StatusBadge} from "@/components/shared/StatusBadge";
import {businessEntities,entitiesForFeature,type EntityKind} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
const views={pipeline:"Cơ hội",quotes:"Báo giá & hợp đồng",tickets:"Hỗ trợ khách hàng",campaigns:"Chiến dịch"} as const;
type View=keyof typeof views;
interface Row{id:string;code:string;name:string;stage?:string;overdue?:boolean;[key:string]:unknown}
interface Snapshot{rows:Row[];total:number;totals:Record<string,number|null>;stages:{stage:string;count:number;amount:number}[];asOf:string}
const stages:Record<string,string>={new:"Mới",qualified:"Đủ điều kiện",proposal:"Báo giá",negotiation:"Đàm phán",won:"Thắng",lost:"Thua",prepared:"Chờ phản hồi",accepted:"Chấp nhận",rejected:"Từ chối",assigned:"Đã phân công",working:"Đang xử lý",resolved:"Đã giải quyết",closed:"Đã đóng"};
const fields:Record<View,[string,string][]>= {
 pipeline:[["customer","Khách hàng"],["owner","Phụ trách"],["stage","Giai đoạn"],["expected_amount","Dự kiến · VND"],["probability","Xác suất · %"],["weighted","Theo xác suất · VND"],["expected_close_on","Dự kiến chốt"],["next_contact_on","Lịch chăm sóc"]],
 quotes:[["customer","Khách hàng"],["revision","Phiên bản"],["stage","Phản hồi"],["total_amount","Trước thuế · VND"],["contracted","Đã ký · VND"],["valid_until","Hiệu lực đến"]],
 tickets:[["customer","Khách hàng"],["owner","Phụ trách"],["stage","Tiến độ"],["response_due_on","Hạn phản hồi"],["first_response_on","Đã phản hồi"],["resolve_due_on","Hạn xử lý"],["overdue","Quá hạn"],["escalated","Chuyển cấp"]],
 campaigns:[["channel","Kênh"],["budget","Ngân sách · VND"],["actual_spend","Đã chi · VND"],["leads","Khách tiềm năng"],["converted","Đã chuyển đổi"],["cost_per_lead","Chi phí / lead · VND"]]
};
const metrics:Record<View,[string,string,string?][]>= {
 pipeline:[["open","Cơ hội đang mở"],["expected","Giá trị dự kiến","VND"],["weighted","Giá trị theo xác suất","VND"],["overdue","Quá lịch chăm sóc"]],
 quotes:[["pending","Chờ khách phản hồi"],["expired","Báo giá hết hiệu lực"],["accepted","Khách chấp nhận"],["contracted","Giá trị đã ký","VND"]],
 tickets:[["open","Yêu cầu đang mở"],["overdue","Yêu cầu quá hạn"],["answeredOnTime","Phản hồi đúng hạn"],["resolvedOnTime","Giải quyết đúng hạn"]],
 campaigns:[["spend","Chi phí thực tế","VND"],["leads","Khách tiềm năng"],["converted","Đã chuyển đổi"],["costPerLead","Chi phí / lead","VND"]]
};
export function BusinessCrmWorkspace({workspace:w}:{workspace:BusinessWorkspace}){
 const [view,setView]=useState<View>("pipeline"),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[data,setData]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/crm?${new URLSearchParams({view,page:String(page)})}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message);if(!c.signal.aborted)setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chưa tải được CRM.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,view,page,revision]);
 const kind:EntityKind=({pipeline:"opportunities",quotes:"customer_quotes",tickets:"support_tickets",campaigns:"campaigns"})[view] as EntityKind;
 function cell(r:Row,key:string){const v=r[key];if(v===null||v===undefined)return "—";if(key==="stage")return <StatusBadge tone={v==="won"||v==="accepted"||v==="resolved"?"success":v==="lost"||v==="rejected"?"warning":"info"}>{stages[String(v)]??String(v)}</StatusBadge>;if(key==="overdue")return <StatusBadge tone={v?"warning":"neutral"}>{v?"Quá hạn":"Trong hạn"}</StatusBadge>;if(key==="escalated")return v==="yes"?"Đã chuyển cấp":"—";if(typeof v==="number")return v.toLocaleString("vi-VN",{maximumFractionDigits:4});if(key.endsWith("_on")||key.endsWith("until"))return String(v).split("-").reverse().join("/");return String(v);}
 return <div className={styles.stack}><PageHeader title="Khách hàng & kinh doanh" action={<Button disabled={loading} onClick={()=>{setLoading(true);setError("");setRevision(v=>v+1);}}>Cập nhật</Button>}/>
  <nav className={styles.quickLinks} aria-label="Nghiệp vụ CRM">{entitiesForFeature(w.industry,w.features,"crm").map(k=><Link prefetch={false} key={k} href={`/erp/${w.slug}/${k}`}>{businessEntities[k].label}</Link>)}</nav>
  <div className={styles.actions}>{Object.entries(views).filter(([k])=>k!=="quotes"||w.features.includes("sales")).map(([k,label])=><Button key={k} variant={view===k?"primary":"secondary"} aria-pressed={view===k} onClick={()=>{setLoading(true);setError("");setView(k as View);setPage(1);setData(null);}}>{label}</Button>)}</div>
  <section className={styles.overviewMetrics} aria-label="Tổng hợp CRM">{metrics[view].map(([key,label,unit])=><div key={key}><span>{label}</span><strong>{loading||error||data?.totals[key]===null||data?.totals[key]===undefined?"—":data.totals[key]?.toLocaleString("vi-VN",{maximumFractionDigits:0})}{unit?` ${unit}`:""}</strong></div>)}</section>
  {view==="pipeline"&&!loading&&!error&&data?<section className={styles.progressSurface} aria-label="Phân bố cơ hội"><h2>Phân bố cơ hội</h2><div>{data.stages.map(s=><div key={s.stage}><span>{stages[s.stage]??s.stage}</span><progress max={Math.max(1,data.total)} value={s.count} aria-label={`${stages[s.stage]} · ${s.count} cơ hội`}/><strong>{s.count} / {data.total}</strong></div>)}</div></section>:null}
  <DataTable<Row> className={styles.operationalTable} loading={loading} error={error} data={data?.rows??[]} getRowId={r=>r.id} emptyTitle="Chưa có phát sinh" columns={[{id:"name",header:"Tên",priority:"primary",cell:r=><Link className={styles.link} prefetch={false} href={`/erp/${w.slug}/${kind}?q=${encodeURIComponent(r.code)}`}>{r.name}</Link>},...fields[view].map(([key,label],i)=>({id:key,header:label,hiddenOnMobile:i>1,cell:(r:Row)=>cell(r,key)}))]}/>
  <div className={styles.pagination}><span>{data?.total??0} bản ghi · Trang {page}{data&&!loading&&!error?` · ${new Date(data.asOf).toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}`:""}</span><div className={styles.actions}><Button disabled={loading||page===1} onClick={()=>{setLoading(true);setError("");setPage(v=>v-1);}}>Trước</Button><Button disabled={loading||page*25>=(data?.total??0)} onClick={()=>{setLoading(true);setError("");setPage(v=>v+1);}}>Sau</Button></div></div>
 </div>;
}
