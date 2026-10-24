"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { DataTable } from "@/components/shared/DataTable";
import { Drawer } from "@/components/shared/Overlays";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { businessEntities, emptyRecord, entitiesFor, recordSchema, recordStates, type EntityKind } from "./businessCatalog";
import type { BusinessWorkspace } from "./businessSchemas";
import { SalesFulfillmentPanel } from "./SalesFulfillmentPanel";
import styles from "./Business.module.css";
import { BusinessReference } from "./BusinessReference";
import { BusinessJournalPanel } from "./BusinessJournalPanel";
import { BusinessCalculationPanel } from "./BusinessCalculationPanel";
import {businessCan,businessActionLabels} from "./businessAccess";
import {BusinessDocumentLines} from "./BusinessDocumentLines";
type Row=Record<string,unknown>&{id:string;code:string;name:string;status:keyof typeof recordStates;row_version:number};
type Command={url:string;body:unknown};
export function BusinessRecords({workspace:w,kind,initialQuery=""}:{workspace:BusinessWorkspace;kind:EntityKind;initialQuery?:string}){
 const definition=businessEntities[kind];const endpoint=`/api/v1/business/${w.slug}`;
 const [rows,setRows]=useState<Row[]>([]);const [total,setTotal]=useState(0);const [page,setPage]=useState(1);const [q,setQ]=useState(initialQuery);const [query,setQuery]=useState(initialQuery);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [formError,setFormError]=useState("");
 const [deliveryPending,setDeliveryPending]=useState(false);
 const [open,setOpen]=useState(false);const [selected,setSelected]=useState<Row|null>(null);const [recordId,setRecordId]=useState("");const [data,setData]=useState<Record<string,unknown>>({});const [baseline,setBaseline]=useState("");const [busy,setBusy]=useState(false);const [pending,setPending]=useState<Command|null>(null);const [reason,setReason]=useState("");const inFlight=useRef(false);
 const allowed=entitiesFor(w.industry,w.features);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await fetch(`${endpoint}/records/${kind}?page=${page}&q=${encodeURIComponent(query)}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message);setRows(b.data.records);setTotal(b.data.total);}catch(e){setError(e instanceof Error?e.message:"Không thể tải dữ liệu.");}finally{setLoading(false);}},[endpoint,kind,page,query]);
 useEffect(()=>{void load();},[load]);
 const generatedOnly=!!definition.generatedOnly||kind==="payables"||(kind==="receivables"&&w.features.includes("accounting"));const financial=!!definition.requiresApproval||["journal_entries","cash_vouchers","vendor_invoices","sales_invoices","supplier_payments","salary_runs","payments"].includes(kind)&&(kind!=="payments"||w.features.includes("accounting"));const dirty=JSON.stringify(data)!==baseline;const editable=!generatedOnly&&businessCan(w,kind,selected?"update":"create")&&(!selected||["active","inactive","draft"].includes(selected.status));
 useEffect(()=>{if(!open||(!dirty&&!pending&&!deliveryPending))return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[open,dirty,pending,deliveryPending]);
 function edit(row:Row|null){const values=row?Object.fromEntries(Object.keys(emptyRecord(kind)).map(k=>[k,row[k]??null])):emptyRecord(kind,w.industry);setSelected(row);setRecordId(row?.id??crypto.randomUUID());setData(values);setBaseline(JSON.stringify(values));setFormError("");setReason("");setPending(null);setOpen(true);}
 function close(){if(busy)return;if((dirty||pending||deliveryPending)&&!window.confirm("Rời biểu mẫu chưa hoàn tất?"))return;setOpen(false);setPending(null);setDeliveryPending(false);}
 async function send(command:Command){if(inFlight.current)return;inFlight.current=true;setBusy(true);setPending(command);setFormError("");try{
  const r=await fetch(command.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command.body),signal:AbortSignal.timeout(20000)});const b=await r.json();
  if(!r.ok||!b.ok){if(r.status<500&&r.status!==429)setPending(null);throw new Error(b.error?.message||"Không thể lưu dữ liệu.");}
  setPending(null);
  const operation=(command.body as {action?:string}).action;
  if(selected&&["calculate","approve"].includes(operation??"")){
   const fresh=await fetch(`${endpoint}/records/${kind}/${selected.id}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const body=await fresh.json();if(!fresh.ok||!body.ok)throw new Error(body.error?.message??"Tải lại chi tiết chứng từ.");
   const row=body.data as Row;const values=Object.fromEntries(Object.keys(emptyRecord(kind)).map(k=>[k,row[k]??null]));setSelected(row);setData(values);setBaseline(JSON.stringify(values));setReason("");
  }else setOpen(false);
  await load();
 }catch(e){setFormError(e instanceof Error?e.message:"Chưa xác nhận kết quả. Thử lại cùng yêu cầu.");}finally{inFlight.current=false;setBusy(false);}}
 function save(e:FormEvent){e.preventDefault();if(!editable||pending)return;const p=recordSchema(kind).safeParse(data);if(!p.success){setFormError("Kiểm tra: "+p.error.issues.map(i=>definition.fields[String(i.path[0])]?.label??({code:"Mã",name:"Tên",notes:"Ghi chú"} as Record<string,string>)[String(i.path[0])]).join(", "));return;}void send({url:`${endpoint}/records/${kind}`,body:{requestId:crypto.randomUUID(),recordId,rowVersion:selected?.row_version??0,data:p.data}});}
 function action(action:string){if(!selected||dirty||pending||deliveryPending||busy||reason.trim().length<3){setFormError("Lưu thay đổi và nhập nội dung thao tác (ít nhất 3 ký tự).");return;}if(!window.confirm("Xác nhận thao tác trên chứng từ này?"))return;void send({url:`${endpoint}/records/${kind}/${selected.id}/actions`,body:{requestId:crypto.randomUUID(),rowVersion:selected.row_version,action,reason}});}
 const disabled=busy||!!pending||deliveryPending||!editable;const actions:string[]=selected&&definition.mode!=="master"?(selected.status==="draft"?[definition.mode==="order"?"release":"post","cancel"]:selected.status==="released"?["complete"]:selected.status==="posted"&&(kind!=="stock_moves"||(!selected.source_id&&!selected.reversed_by))&&!selected.source_receipt_id&&!(kind==="receivables"&&selected.sales_order_id)?["reverse"]:[]):[];
 if(generatedOnly)actions.length=0;
 if(selected&&kind==="journal_entries"&&selected.source_id)actions.length=0;
 if(selected?.status==="draft"&&financial){if(selected.created_by!==w.accountId&&!selected.reviewed_by)actions.unshift("approve");if(!selected.reviewed_by)actions.splice(actions.indexOf("post"),1);}
 const calculable=!!definition.calculable||["asset_charge_runs","loan_movements","costing_runs","stock_valuation_runs","closing_runs","tax_filings","payroll_tax_runs","payroll_cost_allocations"].includes(kind);
 if(selected?.status==="draft"&&calculable){actions.unshift("calculate");if(!selected.calculation_snapshot){for(const action of ["approve","post"]){const i=actions.indexOf(action);if(i>=0)actions.splice(i,1);}}}
 for(let i=actions.length-1;i>=0;i--)if(!businessCan(w,kind,actions[i] as keyof typeof businessActionLabels))actions.splice(i,1);
 const actionLabels:Record<string,string>={calculate:"Tính & đối chiếu",approve:"Duyệt chứng từ",post:["accounting","assets","costing"].includes(definition.feature)||kind==="payments"&&w.features.includes("accounting")?"Ghi sổ":"Ghi nhận",release:kind==="accounting_periods"?"Mở kỳ":"Phát hành",complete:kind==="accounting_periods"?"Khóa kỳ":"Hoàn thành",cancel:"Hủy nháp",reverse:"Đảo chứng từ"};
 return <div className={styles.stack}><PageHeader title={definition.label} action={businessCan(w,kind,"create")&&!generatedOnly?<Button variant="primary" onClick={()=>edit(null)}>Tạo mới</Button>:undefined}/><form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setPage(1);setQuery(q);}}><Input label="Tìm mã hoặc tên" maxLength={100} value={q} onChange={e=>setQ(e.target.value)}/><Button type="submit">Tìm kiếm</Button><Button onClick={()=>void load()}>Tải lại</Button></form>
 <DataTable data={rows} loading={loading} error={error} emptyTitle="Chưa có dữ liệu" getRowId={r=>r.id} columns={[{id:"code",header:"Mã",accessor:"code",priority:"primary"},{id:"name",header:"Tên",accessor:"name"},{id:"status",header:"Trạng thái",cell:r=><StatusBadge tone={r.status==="draft"?"neutral":r.status==="cancelled"?"warning":"info"}>{recordStates[r.status]}</StatusBadge>},...Object.entries(definition.fields).filter(([,f])=>(!f.requiresFeature||w.features.includes(f.requiresFeature))&&(!f.ref||allowed.includes(f.ref))).map(([key,f])=>({id:key,header:f.label,hiddenOnMobile:true,cell:(r:Row)=>f.type==="enum"?f.values?.[String(r[key])]??"—":f.type==="ref"?((r.references as Record<string,string>|undefined)?.[key]??"—"):r[key]===null?"—":typeof r[key]==="number"?Number(r[key]).toLocaleString("vi-VN",{maximumFractionDigits:4}):String(r[key]??"—")}))]} actions={r=><Button onClick={()=>edit(r)}>Mở</Button>}/>
 <div className={styles.pagination}><span>{total.toLocaleString("vi-VN")} bản ghi · Trang {page}/{Math.max(1,Math.ceil(total/25))}</span><div className={styles.actions}><Button disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Trước</Button><Button disabled={loading||page*25>=total} onClick={()=>setPage(p=>p+1)}>Sau</Button></div></div>
 <Drawer open={open} title={`${selected?"Chi tiết":"Tạo mới"} · ${definition.label}`} onClose={close}><div className={styles.stack}>
 {selected&&financial?<StatusBadge tone={selected.reviewed_by?"success":"neutral"}>{selected.reviewed_by?"Đã duyệt":"Chờ người khác duyệt"}</StatusBadge>:null}
 {selected?.calculation_snapshot?<BusinessCalculationPanel kind={kind} snapshot={selected.calculation_snapshot}/>:null}
 {formError?<div className="form-alert form-alert--error" role="alert">{formError}</div>:null}
 {pending&&!busy?<Button onClick={()=>void send(pending)}>Thử lại cùng yêu cầu</Button>:null}
 <form onSubmit={save} className={styles.stack}><div className={styles.fields}>{(["code","name"] as const).map(k=><Input key={k} label={k==="code"?"Mã":"Tên"} required value={String(data[k]??"")} maxLength={k==="code"?50:180} disabled={disabled} onChange={e=>setData(v=>({...v,[k]:e.target.value}))}/>)}
 {Object.entries(definition.fields).map(([key,f])=>{
  if(f.requiresFeature&&!w.features.includes(f.requiresFeature))return null;
  if(f.computed)return selected?<Input key={key} label={f.label} readOnly value={f.values?.[String(selected[key])]??String(selected[key]??"")}/>:null;
  if(f.ref&&!allowed.includes(f.ref))return null;
  const value=data[key];const patch=(value:unknown)=>setData(v=>({...v,[key]:value}));
  if(f.type==="ref")return <BusinessReference key={recordId+key} slug={w.slug} kind={f.ref!} label={f.label} value={value?String(value):null} initialLabel={(selected?.references as Record<string,string>|undefined)?.[key]} required={f.required} disabled={disabled} onChange={patch}/>;
  if(f.type==="enum")return <Select key={key} label={f.label} value={String(value??"")} disabled={disabled} required={f.required} options={[...(!f.required&&f.default===undefined?[{value:"",label:"Chưa chọn"}]:[]),...Object.entries(f.values!).map(([value,label])=>({value,label}))]} onChange={e=>patch(e.target.value||null)}/>;
  return <Input key={key} label={f.label} type={f.type==="number"?"number":f.type==="date"?"date":f.type==="time"?"time":f.type==="email"?"email":"text"} min={f.min} max={f.type==="number"?f.max??1e15:undefined} step={f.type==="number"?(f.integer?1:"0.0001"):undefined} maxLength={f.type==="text"||f.type==="email"?f.max??240:undefined} required={f.required||f.default!==undefined||(kind==="lots"&&w.industry==="food_beverage"&&key==="expires_on")} disabled={disabled} value={value===null||value===undefined?"":String(value)} onChange={e=>patch(e.target.value===""?null:f.type==="number"?Number(e.target.value):e.target.value)}/>;
 })}<div className={styles.full}><Textarea label="Ghi chú" rows={3} maxLength={2000} value={String(data.notes??"")} disabled={disabled} onChange={e=>setData(v=>({...v,notes:e.target.value}))}/></div></div>
 <div className={styles.actions}>{editable?<Button type="submit" variant="primary" busy={busy} disabled={disabled}>{definition.mode==="master"?"Lưu":"Lưu nháp"}</Button>:null}<Button onClick={close} disabled={busy}>Đóng</Button></div></form>
 {selected&&definition.lineKind&&businessCan(w,definition.lineKind,"read")?<BusinessDocumentLines workspace={w} parentKind={kind} parentId={selected.id} parentVersion={selected.row_version} editable={selected.status==="draft"} disabled={busy||!!pending||dirty} onBusyChange={setBusy} onPendingChange={setDeliveryPending} onParentUpdated={(version,reviewedBy)=>setSelected(v=>v&&version>v.row_version?{...v,row_version:version,reviewed_by:reviewedBy,calculation_snapshot:null}:v)}/>:null}
 {w.role!=="viewer"&&actions.length?<div className={styles.stack}><Textarea label="Nội dung thao tác" rows={2} minLength={3} maxLength={500} value={reason} disabled={busy||!!pending||deliveryPending} onChange={e=>setReason(e.target.value)}/><div className={styles.actions}>{actions.map(a=><Button key={a} disabled={busy||!!pending||deliveryPending||dirty} onClick={()=>action(a)}>{actionLabels[a]}</Button>)}</div></div>:null}
 {open&&selected&&kind==="journal_entries"?<BusinessJournalPanel key={selected.id} slug={w.slug} journalId={selected.id} onBusyChange={setBusy} onPendingChange={setDeliveryPending} editable={editable&&!selected.source_id&&!dirty&&!busy&&!pending} onUpdated={(version,reviewedBy)=>setSelected(v=>v?{...v,row_version:version,reviewed_by:reviewedBy}:v)}/>:null}
 {open&&selected?.posted_journal_id&&businessCan(w,"journal_entries","read")?<BusinessJournalPanel key={String(selected.posted_journal_id)} slug={w.slug} journalId={String(selected.posted_journal_id)} editable={false} onBusyChange={()=>{}} onPendingChange={()=>{}} onUpdated={()=>{}}/>:null}
 {open&&selected&&kind==="sales_orders"?<SalesFulfillmentPanel key={selected.id} slug={w.slug} orderId={selected.id} viewer={w.role==="viewer"} disabled={busy||!!pending||dirty} onBusyChange={setBusy} onPendingChange={setDeliveryPending} onCommitted={()=>{setOpen(false);void load();}}/>:null}
 </div></Drawer></div>;
}
