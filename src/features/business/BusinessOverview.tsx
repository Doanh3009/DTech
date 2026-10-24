"use client";
import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/shared/Button";
import type { BusinessWorkspace } from "./businessSchemas";
import { CompanyDashboard } from "./CompanyDashboard";
import type { CompanyDashboardSnapshot } from "./businessDashboardData";
import styles from "./Business.module.css";

export function BusinessOverview({workspace:w,children,initialMonth}:{workspace:BusinessWorkspace;children?:ReactNode;initialMonth:string}){
 const [month,setMonth]=useState(initialMonth);const [data,setData]=useState<CompanyDashboardSnapshot|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/dashboard?month=${month}`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message??"Chưa tải được dashboard.");setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải dữ liệu.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,month,reload]);
 const months=Array.from({length:12},(_,i)=>{const d=new Date(`${initialMonth}-01T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()-i);return d.toISOString().slice(0,7);});
 return <div className={styles.stack}><div className={styles.dashboardToolbar}><h2>Tổng quan doanh nghiệp</h2><div><label>Kỳ theo dõi<select aria-label="Kỳ theo dõi" value={month} disabled={loading} onChange={e=>{setMonth(e.target.value);setData(null);setLoading(true);setError("");}}>{months.map(m=><option key={m} value={m}>Tháng {m.slice(5)}/{m.slice(0,4)}</option>)}</select></label><Button busy={loading} leftIcon={<RefreshCw size={15} aria-hidden="true"/>} onClick={()=>{setData(null);setLoading(true);setError("");setReload(v=>v+1);}}>Cập nhật</Button></div></div>
 {error?<div role="alert" className={styles.error}>{error}</div>:null}
 {loading?<div role="status" className={styles.dashboardLoading}>Đang tổng hợp dữ liệu doanh nghiệp…</div>:data?<CompanyDashboard data={data} industry={w.industry} baseHref={`/erp/${w.slug}`} features={w.features}/>:null}
 <section className={styles.stack} aria-label="Ứng dụng doanh nghiệp"><h2>Ứng dụng doanh nghiệp</h2>{children}</section></div>;
}
