"use client";
import {BusinessLink as Link} from "./BusinessLink";
import { useEffect,useState } from "react";
import { Button } from "@/components/shared/Button";
import { Input,Select } from "@/components/shared/FormControls";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { businessEntities,entitiesFor,recordStates,type EntityKind } from "./businessCatalog";
import type { BusinessWorkspace } from "./businessSchemas";
import { misaViews,misaColumnLabels,misaStateLabels,type MisaView } from "./businessMisaViews";
import styles from "./Business.module.css";
type Row=Record<string,string|number|boolean|null>;
interface Snapshot{rows:Row[];total:number;totals:Record<string,number>;asOf:string}
export function BusinessMisaWorkspace({workspace:w,initialView,embedded=false}:{workspace:BusinessWorkspace;initialView:MisaView;embedded?:boolean}){
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());
 const [view,setView]=useState(initialView);const [from,setFrom]=useState(today.slice(0,7)+"-01"),[to,setTo]=useState(today);const [filters,setFilters]=useState({from,to});const [page,setPage]=useState(1),[reload,setReload]=useState(0);const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const config=misaViews[view];const allowed=entitiesFor(w.industry,w.features);
 const available=(initialView==="assets"?["assets"]:initialView==="costing"?["costing"]:["bank","advances","loans","payroll","tax","reports"]).filter(v=>allowed.includes(misaViews[v as MisaView].kind)) as MisaView[];
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/misa?${new URLSearchParams({view,from:filters.from,to:filters.to,page:String(page)})}`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message??"Chưa tải được dữ liệu.");setSnapshot(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải dữ liệu.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,view,filters,page,reload]);
 function selectView(v:MisaView){setView(v);setSnapshot(null);setPage(1);setLoading(true);setError("");}
 function render(row:Row,key:string){const val=row[key];if(val===null||val===undefined)return "—";if(key==="code")return <Link prefetch={false} className={styles.link} href={`/erp/${w.slug}/${view==="payroll"?"salary_runs":config.kind}?q=${encodeURIComponent(String(val))}`}>{String(val)}</Link>;if(["status","submission_state","service_state","match_state"].includes(key))return <StatusBadge tone={["accepted","matched","posted"].includes(String(val))?"success":["unmatched","rejected","maintenance"].includes(String(val))?"warning":"neutral"}>{misaStateLabels[String(val)]??recordStates[String(val) as keyof typeof recordStates]??String(val)}</StatusBadge>;if(typeof val==="number")return <span className={styles.numeric}>{val.toLocaleString("vi-VN",{maximumFractionDigits:2})}</span>;if(/_on$|_date$/.test(key))return String(val).split("-").reverse().join("/");return misaStateLabels[String(val)]??String(val);}
 return <div className={styles.stack}>{!embedded?<PageHeader title={initialView==="assets"?"Tài sản & phân bổ":"Giá thành & giá vốn"}/>:null}
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setSnapshot(null);setPage(1);setFilters({from,to});setLoading(true);setError("");setReload(n=>n+1);}}>{available.length>1?<Select label="Phần hành" value={view} options={available.map(v=>({value:v,label:misaViews[v].label}))} onChange={e=>selectView(e.target.value as MisaView)}/>:null}<Input label="Từ ngày" type="date" required value={from} max={to} onChange={e=>setFrom(e.target.value)}/><Input label="Đến ngày" type="date" required value={to} min={from} onChange={e=>setTo(e.target.value)}/><Button disabled={loading} type="submit">Xem dữ liệu</Button></form>
 <section className={styles.overviewMetrics} aria-label={config.label}>{Object.entries(config.metrics).map(([key,label])=><div key={key}><span>{label}</span><strong>{loading||error||!snapshot?"—":Number(snapshot.totals[key]??0).toLocaleString("vi-VN",{maximumFractionDigits:2})}</strong></div>)}</section>
 <nav className={styles.quickLinks} aria-label="Chứng từ phần hành">{config.links.filter(k=>allowed.includes(k)).map(k=><Link prefetch={false} key={k} href={`/erp/${w.slug}/${k}`}>{businessEntities[k as EntityKind].label}</Link>)}</nav>
 <div className={styles.actions}><h2>{config.label}</h2><StatusBadge tone="neutral">{["assets","advances","loans","payroll"].includes(view)?"Dư hiện tại":"Theo kỳ"} · VND</StatusBadge></div>
 <DataTable<Row> className={styles.operationalTable} ariaLabel={config.label} loading={loading} error={error} data={snapshot?.rows??[]} getRowId={r=>String(r.id)} emptyTitle="Chưa có dữ liệu" columns={config.columns.map((key,i)=>({id:key,header:misaColumnLabels[key]??key,priority:i===0?"primary":undefined,hiddenOnMobile:i>2,cell:r=>render(r,key)}))}/>
 <div className={styles.pagination}><span>{snapshot?.total??0} bản ghi · Trang {page}/{Math.max(1,Math.ceil((snapshot?.total??0)/25))}</span><div className={styles.actions}><Button disabled={loading||page===1} onClick={()=>{setPage(n=>n-1);setLoading(true);setError("");}}>Trước</Button><Button disabled={loading||page*25>=(snapshot?.total??0)} onClick={()=>{setPage(n=>n+1);setLoading(true);setError("");}}>Sau</Button></div></div></div>;
}
