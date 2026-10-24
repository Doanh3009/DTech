"use client";
import {BusinessLink as Link} from "./BusinessLink";
import { useEffect, useState } from "react";
import { BookOpenCheck, Landmark, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Input, Select } from "@/components/shared/FormControls";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { recordStates } from "./businessCatalog";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";
import finance from "./BusinessAccountingWorkspace.module.css";
import { BusinessMisaWorkspace } from "./BusinessMisaWorkspace";

type Row=Record<string,string|number|null>;
interface Snapshot {trial:Row[];ledger:Row[];journals:Row[];receivables:Row[];payables:Row[];periods:Row[];totals:{debit:number;credit:number;cash:number;receivables:number;payables:number};ledgerLimit:number;journalLimit:number}
const number=(v:unknown)=>Number(v??0).toLocaleString("vi-VN",{maximumFractionDigits:0});
const views={journals:"Nhật ký chung",trial:"Cân đối phát sinh",ledger:"Sổ cái",receivables:"Phải thu",payables:"Phải trả",periods:"Kỳ kế toán"} as const;
const labels:Record<string,string>={code:"Số chứng từ",name:"Diễn giải",document_date:"Ngày chứng từ",posting_date:"Ngày hạch toán",status:"Trạng thái",debit:"Nợ",credit:"Có",opening:"Dư đầu kỳ",closing:"Dư cuối kỳ",account:"Tài khoản",account_name:"Tên tài khoản",partner:"Đối tác",project:"Dự án",reviewer:"Người duyệt",creator:"Người lập",amount:"Giá trị",paid_amount:"Đã thanh toán",remaining:"Còn lại",due_date:"Hạn thanh toán",starts_on:"Từ ngày",ends_on:"Đến ngày"};
const columns:Record<keyof typeof views,string[]>={journals:["code","name","posting_date","status","debit","credit","creator","reviewer"],trial:["code","name","opening","debit","credit","closing"],ledger:["code","posting_date","name","account","account_name","debit","credit","partner","project"],receivables:["code","partner","amount","paid_amount","remaining","due_date"],payables:["code","partner","amount","paid_amount","remaining","due_date"],periods:["code","name","starts_on","ends_on","status"]};
export function BusinessAccountingWorkspace({workspace:w}:{workspace:BusinessWorkspace}){
 const [area,setArea]=useState<"books"|"extensions">("books");
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());
 const [from,setFrom]=useState(today.slice(0,7)+"-01"),[to,setTo]=useState(today),[account,setAccount]=useState("");
 const [filters,setFilters]=useState({from,to,account}),[reload,setReload]=useState(0),[view,setView]=useState<keyof typeof views>("journals");
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();fetch(`/api/v1/business/${w.slug}/finance?${new URLSearchParams({from:filters.from,to:filters.to,...(filters.account?{account:filters.account}:{})})}`,{cache:"no-store",signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message||"Chưa tải được sổ kế toán.");setSnapshot(b.data);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Chưa tải được sổ kế toán.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[w.slug,filters,reload]);
 const metrics=[{label:"Tiền mặt & ngân hàng",value:snapshot?.totals.cash??0,icon:Landmark},{label:"Công nợ phải thu",value:snapshot?.totals.receivables??0,icon:ArrowDownLeft},{label:"Công nợ phải trả",value:snapshot?.totals.payables??0,icon:ArrowUpRight},{label:"Phát sinh Nợ / Có",value:snapshot?.totals.debit??0,icon:BookOpenCheck}];
 return <div className={styles.stack}><PageHeader title="Kế toán" action={w.role!=="viewer"?<Link prefetch={false} className="button button--primary button--md" href={`/erp/${w.slug}/journal_entries`}>Lập chứng từ</Link>:undefined}/><nav className={styles.actions} aria-label="Không gian kế toán"><Button aria-pressed={area==="books"} variant={area==="books"?"primary":"secondary"} onClick={()=>setArea("books")}>Sổ kế toán</Button><Button aria-pressed={area==="extensions"} variant={area==="extensions"?"primary":"secondary"} onClick={()=>setArea("extensions")}>Quỹ, ngân hàng, lương & thuế</Button></nav>{area==="extensions"?<BusinessMisaWorkspace workspace={w} initialView="bank" embedded/>:<>
 <section className={finance.metrics} aria-label="Tổng hợp kế toán">{metrics.map(m=><div key={m.label} className={finance.metric}><m.icon size={20} aria-hidden="true"/><span>{m.label}</span><strong>{loading||!snapshot?"—":number(m.value)}<small> VND</small></strong></div>)}</section>
 <section className={finance.book}><form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setLoading(true);setError("");setFilters({from,to,account});setReload(v=>v+1);}}><Input label="Từ ngày" type="date" required value={from} max={to} onChange={e=>setFrom(e.target.value)}/><Input label="Đến ngày" type="date" required value={to} min={from} onChange={e=>setTo(e.target.value)}/><Select label="Tài khoản sổ cái" value={account} onChange={e=>setAccount(e.target.value)} options={[{value:"",label:"Tất cả tài khoản"},...(snapshot?.trial??[]).map(r=>({value:String(r.id),label:`${r.code} · ${r.name}`}))]}/><Button type="submit" disabled={loading}>Xem sổ</Button></form>
 <div className={finance.tabs} role="tablist" aria-label="Sổ kế toán">{Object.entries(views).map(([key,label])=><button key={key} id={`tab-${key}`} role="tab" aria-controls="finance-book" aria-selected={key===view} onClick={()=>setView(key as keyof typeof views)}>{label}</button>)}</div>
 <div id="finance-book" role="tabpanel" aria-labelledby={`tab-${view}`}><DataTable<Row> className={styles.operationalTable} data={snapshot?.[view]??[]} loading={loading} error={error} emptyTitle="Chưa có phát sinh trong kỳ" columns={columns[view].map((key,i)=>({id:key,header:labels[key],priority:i===0?"primary":undefined,hiddenOnMobile:i>2,cell:r=>key==="status"?<StatusBadge tone={r[key]==="posted"?"success":"neutral"}>{view==="periods"?(r[key]==="released"?"Đang mở":r[key]==="completed"?"Đã khóa":"Nháp"):r[key]==="posted"?"Đã ghi sổ":recordStates[r[key] as keyof typeof recordStates]}</StatusBadge>:key==="code"&&view==="journals"?<Link prefetch={false} className={styles.link} href={`/erp/${w.slug}/journal_entries?q=${encodeURIComponent(String(r.code))}`}>{r.code}</Link>:["debit","credit","opening","closing","amount","paid_amount","remaining"].includes(key)?<span className={styles.numeric}>{number(r[key])}</span>:r[key]??"—"}))}/></div>
 <div className={finance.bookFooter}><span>{view==="ledger"?`Tối đa ${snapshot?.ledgerLimit??250} dòng · Theo bộ lọc`:view==="journals"?`Tối đa ${snapshot?.journalLimit??100} chứng từ · Theo bộ lọc`:view==="receivables"||view==="payables"?"Dư hiện tại · Tối đa 250 khoản":"VND"}</span><StatusBadge tone={snapshot&&snapshot.totals.debit===snapshot.totals.credit?"success":"neutral"}>{snapshot?`Chênh lệch Nợ / Có: ${number(snapshot.totals.debit-snapshot.totals.credit)}`:"Đang tải"}</StatusBadge></div>
 </section></>}</div>;
}
