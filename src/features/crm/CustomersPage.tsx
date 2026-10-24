"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { SearchInput, Select } from "@/components/shared/FormControls";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { industryPresets } from "@/config/erpModules";
import { can } from "@/lib/auth/permissions";
import { crmStages, type CrmCustomer } from "./crmSchemas";
import styles from "./Crm.module.css";

export function CustomersPage(){
 const user=useCurrentUser();const [query,setQuery]=useState("");const [stage,setStage]=useState("");const [page,setPage]=useState(1);const [retry,setRetry]=useState(0);
 const [data,setData]=useState<{customers:CrmCustomer[];total:number}>({customers:[],total:0});const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>{setLoading(true);setError("");const p=new URLSearchParams({page:String(page),q:query,stage});void fetch(`/api/v1/crm/customers?${p}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok||!Array.isArray(b.data?.customers))throw new Error();if(!c.signal.aborted)setData(b.data);}).catch(()=>{if(!c.signal.aborted)setError("Không thể tải hồ sơ khách hàng.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},250);return()=>{clearTimeout(timer);c.abort();};},[page,query,stage,retry]);
 const columns:DataTableColumn<CrmCustomer>[]=[{id:"company",header:"Doanh nghiệp",cell:r=><><Link className={styles.companyLink} href={`/control-center/customers/${r.customerId}`}>{r.profile.companyName}</Link><span className={styles.meta}>{r.profile.contactName} · {r.profile.phone}</span></>},{id:"industry",header:"Ngành",cell:r=>industryPresets.find(p=>p.id===r.profile.industry)?.label},{id:"stage",header:"Giai đoạn",cell:r=><StatusBadge tone={r.stage==="active"?"success":r.stage==="closed"?"neutral":"info"}>{crmStages[r.stage]}</StatusBadge>},{id:"owner",header:"Phụ trách",cell:r=>r.profile.ownerName||"Chưa phân công"},{id:"next",header:"Hẹn tiếp theo",cell:r=>r.profile.nextContactOn?new Date(r.profile.nextContactOn).toLocaleDateString("vi-VN"):"—"}];
 return <div className={styles.stack}><PageHeader title="Khách hàng & triển khai" action={can(user.permissions,"crm.manage")?<Link className="button button--primary button--md" href="/control-center/customers/new"><Plus aria-hidden="true" size={17}/>Tạo hồ sơ</Link>:undefined}/><div className={styles.toolbar}><SearchInput label="Tìm doanh nghiệp" placeholder="Tên doanh nghiệp, email, điện thoại..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><Select label="Giai đoạn" value={stage} onChange={e=>{setStage(e.target.value);setPage(1);}} options={[{value:"",label:"Tất cả giai đoạn"},...Object.entries(crmStages).map(([value,label])=>({value,label}))]}/><Button onClick={()=>setRetry(v=>v+1)}>Tải lại</Button></div><DataTable ariaLabel="Khách hàng triển khai" columns={columns} data={data.customers} getRowId={r=>r.customerId} loading={loading} error={error||undefined} emptyTitle="Chưa có hồ sơ khách hàng"/><footer className={styles.pagination}><span>{data.total} khách hàng · Trang {page}/{Math.max(1,Math.ceil(data.total/25))}</span><div className={styles.actions}><Button disabled={page===1||loading} onClick={()=>setPage(v=>v-1)}>Trước</Button><Button disabled={page*25>=data.total||loading} onClick={()=>setPage(v=>v+1)}>Sau</Button></div></footer></div>;
}
