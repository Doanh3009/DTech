"use client";
import {BusinessLink as Link} from "./BusinessLink";
import { useEffect, useState } from "react";
import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { businessEntities, entitiesFor, featureLabels, recordStates, type BusinessFeature } from "./businessCatalog";
import { businessWorkflows, enrichOperationRow, industryOperationView, industrySteps, operationColumnLabels, type OperationRow, type OperationsSnapshot } from "./businessWorkflows";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";
import { TraceabilityExplorer } from "./TraceabilityExplorer";

const values: Record<string,string> = {available:"Khả dụng",blocked:"Bị chặn",expired:"Hết hạn",expiring:"Hết hạn trong 30 ngày",quarantine:"Chờ kiểm tra",released:"Được sử dụng",rejected:"Không đạt",material:"Vật tư",labor:"Nhân công",subcontract:"Thầu phụ",overhead:"Chi phí chung",call:"Cuộc gọi",email:"Email",meeting:"Cuộc hẹn",note:"Ghi chú"};
export function BusinessModuleWorkspace({workspace:w,feature}:{workspace:BusinessWorkspace;feature:BusinessFeature}) {
 const [snapshot,setSnapshot]=useState<OperationsSnapshot|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [reload,setReload]=useState(0);
 const view=industryOperationView(w.industry,feature);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/operations?feature=${feature}`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message||"Không thể tải nghiệp vụ.");setSnapshot(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải nghiệp vụ.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,feature,reload]);
 function cell(row:OperationRow,key:string){const v=row[key];if(v===null||v===undefined)return "—";if(key==="status")return <StatusBadge tone="neutral">{recordStates[String(v) as keyof typeof recordStates]??String(v)}</StatusBadge>;if(["quality_state","availability"].includes(key))return <StatusBadge tone={["blocked","expired","rejected"].includes(String(v))?"error":["quarantine","expiring"].includes(String(v))?"warning":"success"}>{values[String(v)]??String(v)}</StatusBadge>;if(typeof v==="number")return <span className={styles.numeric}>{v.toLocaleString("vi-VN",{maximumFractionDigits:4})}</span>;if(/_on$|_date$/.test(key))return <span className={styles.numeric}>{String(v).split("-").reverse().join("/")}</span>;return values[String(v)]??String(v);}
 const table=(detail=false)=>{const kind=detail?view.detailKind!:view.kind;const columns=detail?view.detailColumns!:view.columns;return <DataTable<OperationRow> className={styles.operationalTable} ariaLabel={detail?view.detailTitle:view.title} loading={loading} error={error} data={(detail?snapshot?.details:snapshot?.rows)?.map(enrichOperationRow)??[]} emptyTitle="Chưa có phát sinh" columns={columns.map((key,i)=>({id:key,header:operationColumnLabels[key],priority:i===0?"primary":undefined,hiddenOnMobile:i>2,cell:(row:OperationRow)=>key==="code"?<Link prefetch={false} className={styles.link} href={`/erp/${w.slug}/${kind}?q=${encodeURIComponent(String(row.code))}`}>{String(row.code)}</Link>:cell(row,key)}))}/>;};
 return <div className={styles.stack}>
  <PageHeader title={featureLabels[feature]} action={<Button onClick={()=>{setLoading(true);setError("");setReload(v=>v+1);}} disabled={loading}>Cập nhật</Button>}/>
  <section className={styles.workflow} aria-label={businessWorkflows[w.industry].title}><ol>{industrySteps(w.industry,w.features).map((step,index)=><li key={`${step.kind}-${index}`}><Link prefetch={false} href={`/erp/${w.slug}/${step.kind}`}><span>{String(index+1).padStart(2,"0")}</span>{step.label}</Link></li>)}</ol></section>
  <nav className={styles.quickLinks} aria-label="Chứng từ trong module">{entitiesFor(w.industry,w.features).filter(k=>businessEntities[k].feature===feature).map(k=><Link prefetch={false} key={k} href={`/erp/${w.slug}/${k}`}>{businessEntities[k].label}</Link>)}</nav>
  {feature==="traceability"?<TraceabilityExplorer slug={w.slug}/>:null}
  <section className={styles.stack}><div className={styles.actions}><h2>{view.title}</h2><StatusBadge tone="neutral">{snapshot?.limit??100} bản ghi gần nhất</StatusBadge></div>{table()}</section>
  {view.detailTitle?<section className={styles.stack}><h2>{view.detailTitle}</h2>{table(true)}</section>:null}
 </div>;
}
