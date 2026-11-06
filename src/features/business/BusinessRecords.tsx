"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input, Textarea } from "@/components/shared/FormControls";
import { DataTable } from "@/components/shared/DataTable";
import { Drawer } from "@/components/shared/Overlays";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {ViewTabs} from "@/components/shared/Tabs";
import { businessEntities, emptyRecord, entitiesFor, recordSchema, recordStates, type EntityKind } from "./businessCatalog";
import type { BusinessWorkspace } from "./businessSchemas";
import { SalesFulfillmentPanel } from "./SalesFulfillmentPanel";
import styles from "./Business.module.css";
import {businessRecordDefaults} from "./businessRecordDefaults";
import {BusinessDocumentDownload} from "./BusinessDocumentDownload";
import {BusinessRecordHistory} from "./BusinessRecordHistory";
import {BusinessSimulationPanel} from "./BusinessSimulationPanel";
import {BusinessRecordFormFields} from "./BusinessRecordFormFields";
import {BusinessColumnChooser} from "./BusinessColumnChooser";
import {defaultRecordColumns,recordFieldText} from "./businessPresentation";
import { BusinessJournalPanel } from "./BusinessJournalPanel";
import { BusinessCalculationPanel } from "./BusinessCalculationPanel";
import {businessCan,businessActionLabels} from "./businessAccess";
import {BusinessDocumentLines} from "./BusinessDocumentLines";
import {BusinessDocumentWorkspace,businessDocumentDrawerClassName} from "./BusinessDocumentWorkspace";
import {BusinessPurchaseReceiving} from "./BusinessPurchaseReceiving";
import {businessRecordNameLabel} from "./businessDocumentLayouts";
import {BusinessApprovalPanel,type ApprovalContext} from "./BusinessApprovalPanel";
import {BusinessExtraForm} from "./BusinessExtraForm";
import {BusinessAttachments} from "./BusinessAttachments";
import {BusinessItemQuantityConverter} from "./BusinessItemQuantityConverter";
import {BusinessCatalogImport} from "./BusinessCatalogImport";
import {canImportCatalog,isImportKind} from "./businessImport";
type Row=Record<string,unknown>&{id:string;code:string;name:string;status:keyof typeof recordStates;row_version:number};
type Command={url:string;body:unknown};
export function BusinessRecords({workspace:w,kind,initialQuery=""}:{workspace:BusinessWorkspace;kind:EntityKind;initialQuery?:string}){
 const definition=businessEntities[kind];const endpoint=`/api/v1/business/${w.slug}`;
 const [rows,setRows]=useState<Row[]>([]);const [total,setTotal]=useState(0);const [page,setPage]=useState(1);const [q,setQ]=useState(initialQuery);const [query,setQuery]=useState(initialQuery);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [formError,setFormError]=useState("");
 const [deliveryPending,setDeliveryPending]=useState(false),[receiptPending,setReceiptPending]=useState(false),[startLineEntry,setStartLineEntry]=useState(false);
 const [attachmentPending,setAttachmentPending]=useState(false);
 const [extraPending,setExtraPending]=useState(false),[approval,setApproval]=useState<ApprovalContext|null>(null),[simulationPending,setSimulationPending]=useState(false);
 const [recordView,setRecordView]=useState("information");
 const [open,setOpen]=useState(false);const [selected,setSelected]=useState<Row|null>(null);const [recordId,setRecordId]=useState("");const [data,setData]=useState<Record<string,unknown>>({});const [baseline,setBaseline]=useState("");const [busy,setBusy]=useState(false);const [pending,setPending]=useState<Command|null>(null);const [reason,setReason]=useState("");const inFlight=useRef(false);
 const allowed=entitiesFor(w.industry,w.features);
 const tableFields=Object.entries(definition.fields).filter(([,field])=>!field.uiHidden&&!field.uiGenerate&&(!field.readRoles||field.readRoles.includes(w.role))&&(!field.requiresFeature||w.features.includes(field.requiresFeature))&&(!field.ref||allowed.includes(field.ref)));
 const [selectedColumns,setSelectedColumns]=useState(()=>defaultRecordColumns(kind,tableFields)),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const errorSummary=useRef<HTMLDivElement>(null);
 const [reloadRecord,setReloadRecord]=useState<string|null>(null),[notice,setNotice]=useState("");
 const formId=`business-record-${recordId}`;
 const editorGeneration=useRef(0),mutationVersion=useRef(0),parentRefresh=useRef<number|null>(null);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await fetch(`${endpoint}/records/${kind}?page=${page}&q=${encodeURIComponent(query)}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message);setRows(b.data.records);setTotal(b.data.total);}catch(e){setError(e instanceof Error?e.message:"Không thể tải dữ liệu.");}finally{setLoading(false);}},[endpoint,kind,page,query]);
 useEffect(()=>{void load();},[load]);
 const generatedOnly=!!definition.generatedOnly||kind==="payables"||(kind==="receivables"&&w.features.includes("accounting"));const financial=!!definition.requiresApproval||["journal_entries","cash_vouchers","vendor_invoices","sales_invoices","supplier_payments","salary_runs","payments"].includes(kind)&&(kind!=="payments"||w.features.includes("accounting"));const dirty=JSON.stringify(data)!==baseline;const recordWritable=!generatedOnly&&businessCan(w,kind,selected?"update":"create")&&(!selected||["active","inactive","draft"].includes(selected.status));const editable=!reloadRecord&&recordWritable;
 useEffect(()=>{if(!open||(!dirty&&!pending&&!deliveryPending&&!receiptPending&&!simulationPending&&!attachmentPending&&!extraPending))return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[open,dirty,pending,deliveryPending,receiptPending,simulationPending,attachmentPending,extraPending]);
 function edit(row:Row|null){editorGeneration.current++;mutationVersion.current=0;parentRefresh.current=null;setStartLineEntry(false);setReceiptPending(false);setRecordView("information");setSimulationPending(false);setReloadRecord(null);setNotice("");const values=row?Object.fromEntries(Object.keys(emptyRecord(kind)).map(k=>[k,row[k]??(k==="notes"?"":null)])):businessRecordDefaults(kind,w.industry);setApproval(null);setFieldErrors({});setExtraPending(false);setAttachmentPending(false);setSelected(row);setRecordId(row?.id??crypto.randomUUID());setData(values);setBaseline(JSON.stringify(values));setFormError("");setReason("");setPending(null);setOpen(true);}
 function close(){if(busy)return;if((dirty||pending||deliveryPending||receiptPending||simulationPending||attachmentPending||extraPending)&&!window.confirm("Rời biểu mẫu chưa hoàn tất?"))return;editorGeneration.current++;setOpen(false);setSimulationPending(false);setPending(null);setDeliveryPending(false);setAttachmentPending(false);}
 async function refreshEditor(id:string,expectedMutation?:number){
  const generation=editorGeneration.current;
  const response=await fetch(`${endpoint}/records/${kind}/${id}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message??"Chứng từ đã được lưu. Tải lại chi tiết để tiếp tục.");
  if(generation!==editorGeneration.current)return false;
  if(expectedMutation!==undefined&&expectedMutation!==mutationVersion.current)throw Error("Chứng từ đã thay đổi trong lúc tải. Giữ lại dữ liệu đang nhập và tải lại khi sẵn sàng.");
  const row=body.data as Row;if(row.id!==id||!Number.isInteger(row.row_version))throw Error("Chứng từ đã được lưu. Tải lại chi tiết để tiếp tục.");
  const values=Object.fromEntries(Object.keys(emptyRecord(kind)).map(key=>[key,row[key]??(key==="notes"?"":null)]));setSelected(row);setRecordId(row.id);setData(values);setBaseline(JSON.stringify(values));setFieldErrors({});setReason("");setApproval(null);setReloadRecord(null);return true;
 }
 async function reloadEditor(){if(!reloadRecord||inFlight.current)return;inFlight.current=true;setBusy(true);setFormError("");try{if(dirty&&!window.confirm("Tải lại chứng từ và bỏ thay đổi đang nhập?"))return;if(!selected&&definition.lineKind)setStartLineEntry(true);await refreshEditor(reloadRecord);if(!selected&&definition.lineKind){setStartLineEntry(true);setRecordView("information");}await load();}catch(cause){setFormError(cause instanceof Error?cause.message:"Chưa tải được chứng từ.");}finally{inFlight.current=false;setBusy(false);}}
 async function refreshAfterOperation(id:string){setReloadRecord(id);try{await refreshEditor(id);await load();}catch(cause){setFormError(cause instanceof Error?cause.message:"Thao tác đã được ghi nhận. Tải lại chứng từ để tiếp tục.");}}
 async function send(command:Command){if(inFlight.current)return;inFlight.current=true;setBusy(true);setPending(command);setFormError("");setNotice("");try{
  const response=await fetch(command.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command.body),signal:AbortSignal.timeout(20000)});const body=await response.json();
  if(!response.ok||!body.ok){if(response.status<500&&response.status!==429)setPending(null);throw Error(body.error?.message||"Không thể lưu dữ liệu.");}
  setPending(null);const operation=(command.body as {action?:string}).action;
  if(definition.mode!=="master"||definition.lineKind||["calculate","approve","submit","recall","return","reject"].includes(operation??"")){
   const id=selected?.id??recordId;setReloadRecord(id);setBaseline(JSON.stringify(data));setNotice(operation?"Đã ghi nhận thao tác":"Đã lưu nháp");if(!selected&&definition.lineKind)setStartLineEntry(true);await refreshEditor(id);if(!selected&&definition.lineKind){setStartLineEntry(true);setRecordView("information");}
  }else setOpen(false);
  await load();
 }catch(cause){setFormError(cause instanceof Error?cause.message:"Chưa xác nhận kết quả. Thử lại cùng yêu cầu.");setTimeout(()=>errorSummary.current?.focus(),0);}finally{inFlight.current=false;setBusy(false);}}
 function changeField(key:string,value:unknown){mutationVersion.current++;setNotice("");setData(current=>({...current,[key]:value}));setFieldErrors(current=>{const next={...current};delete next[key];return next;});}
 function save(e:FormEvent){e.preventDefault();if(!editable||pending)return;const autoCode=!selected&&definition.mode!=="master"&&String(data.code??"").trim()==="";const parsed=recordSchema(kind,{autoCode}).safeParse(data);if(!parsed.success){setRecordView("information");const errors:Record<string,string>={};for(const issue of parsed.error.issues){const key=String(issue.path[0]??""),label=definition.fields[key]?.label??({code:"Mã",name:businessRecordNameLabel(kind),notes:"Ghi chú"} as Record<string,string>)[key]??"Dữ liệu";errors[key]=/[À-ỹ]/u.test(issue.message)?issue.message:label+" chưa hợp lệ.";}setFieldErrors(errors);setFormError("Kiểm tra các trường được đánh dấu.");setTimeout(()=>{const field=Object.keys(errors)[0],focusField=field==="entry_quantity"?"quantity":field==="entry_price"?definition.quantityEntry?.priceField??field:field;const first=document.getElementById(recordId+"-"+focusField);if(first)first.focus();else errorSummary.current?.focus();},0);return;}setFieldErrors({});void send({url:endpoint+"/records/"+kind,body:{requestId:crypto.randomUUID(),recordId,rowVersion:selected?.row_version??0,...(autoCode?{autoNumber:true}:{}),data:parsed.data}});}

 function acceptParentVersion(version:number,_reviewedBy:string|null,origin:"read"|"write"="read"){
  if(!selected||version<=selected.row_version)return;
  const id=selected.id,generation=editorGeneration.current;setReloadRecord(id);
  if(dirty||pending||origin==="read"&&(deliveryPending||receiptPending||extraPending||attachmentPending||simulationPending)){
   setFormError("Chứng từ đã có phiên bản mới. Giữ lại dữ liệu đang nhập; tải lại trước khi lưu tiếp.");return;
  }
  if(parentRefresh.current===generation)return;parentRefresh.current=generation;
  void refreshEditor(id,mutationVersion.current).catch(cause=>{if(editorGeneration.current===generation)setFormError(cause instanceof Error?cause.message:"Chưa tải được phiên bản mới của chứng từ.");}).finally(()=>{if(parentRefresh.current===generation)parentRefresh.current=null;});
 }
 function action(action:string,decisionReason=reason){if(!selected||reloadRecord||dirty||pending||deliveryPending||receiptPending||simulationPending||attachmentPending||extraPending||busy||decisionReason.trim().length<3){setFormError("Lưu thay đổi và nhập nội dung thao tác (ít nhất 3 ký tự).");return;}if(!window.confirm("Xác nhận thao tác trên chứng từ này?"))return;void send({url:`${endpoint}/records/${kind}/${selected.id}/actions`,body:{requestId:crypto.randomUUID(),rowVersion:selected.row_version,action,reason:decisionReason}});}
 const disabled=!!reloadRecord||busy||!!pending||deliveryPending||receiptPending||simulationPending||attachmentPending||extraPending||!editable;const actions:string[]=selected&&definition.mode!=="master"?(selected.status==="draft"?[definition.mode==="order"?"release":"post","cancel"]:selected.status==="released"?["complete"]:selected.status==="posted"&&(kind!=="stock_moves"||(!selected.source_id&&!selected.reversed_by))&&!selected.source_receipt_id&&!(kind==="receivables"&&selected.sales_order_id)?["reverse"]:[]):[];
 if(selected&&definition.mode!=="master"&&(!approval||approval.documentVersion!==selected.row_version)){for(const a of ["approve","post","release"]){const i=actions.indexOf(a);if(i>=0)actions.splice(i,1);}}
 if(approval?.required){const i=actions.indexOf("approve");if(i>=0)actions.splice(i,1);if(approval.status!=="approved"||approval.stale){for(const a of ["post","release"]){const j=actions.indexOf(a);if(j>=0)actions.splice(j,1);}}}
 if(generatedOnly)actions.length=0;
 if(selected&&kind==="journal_entries"&&selected.source_id)actions.length=0;
 if(selected?.status==="draft"&&financial){if(selected.created_by!==w.accountId&&!selected.reviewed_by)actions.unshift("approve");if(!selected.reviewed_by)actions.splice(actions.indexOf("post"),1);}
 const calculable=!!definition.calculable||["asset_charge_runs","loan_movements","costing_runs","stock_valuation_runs","closing_runs","tax_filings","payroll_tax_runs","payroll_cost_allocations"].includes(kind);
 if(selected?.status==="draft"&&calculable){actions.unshift("calculate");if(!selected.calculation_snapshot){for(const action of ["approve","post"]){const i=actions.indexOf(action);if(i>=0)actions.splice(i,1);}}}
 for(let i=actions.length-1;i>=0;i--)if(!businessCan(w,kind,actions[i] as keyof typeof businessActionLabels))actions.splice(i,1);
 if(selected&&definition.mode!=="master")for(let i=actions.length-1;i>=0;i--)if(["approve","post","release"].includes(actions[i])&&(!approval||approval.documentVersion!==selected.row_version||approval.required&&(actions[i]==="approve"||approval.status!=="approved"||approval.stale)))actions.splice(i,1);
 const hasLines=!!selected&&(!!definition.lineKind&&allowed.includes(definition.lineKind)&&businessCan(w,definition.lineKind,"read")||kind==="journal_entries"||!!selected.posted_journal_id&&businessCan(w,"journal_entries","read")||kind==="sales_orders");
 const recordTabs=[{value:"information",label:definition.lineKind?"Chứng từ":"Thông tin"},...(hasLines&&(!definition.lineKind||kind==="sales_orders")?[{value:"lines",label:kind==="sales_orders"?"Giao hàng":"Bút toán"}]:[]),...(selected&&kind==="purchase_orders"&&businessCan(w,"purchase_lines","read")?[{value:"receiving",label:"Nhận hàng & đối chiếu"}]:[]),...(selected&&definition.mode!=="master"?[{value:"review",label:"Duyệt & ghi nhận"},{value:"files",label:"Tệp & biểu mẫu"}]:[]),...(selected&&w.isDemo&&definition.simulationServices?.length&&businessCan(w,kind,"report")?[{value:"simulation",label:"Mô phỏng"}]:[]),...(selected?[{value:"history",label:"Lịch sử"}]:[])];
 function changeRecordView(next:string){if(next===recordView)return;if(dirty||pending||deliveryPending||receiptPending||extraPending||attachmentPending||simulationPending){setFormError("Hoàn tất hoặc bỏ thay đổi đang nhập trước khi chuyển phần hành.");return;}setFormError("");setRecordView(next);}
 const actionLabels:Record<string,string>={calculate:"Tính & đối chiếu",approve:"Duyệt chứng từ",post:["accounting","assets","costing"].includes(definition.feature)||kind==="payments"&&w.features.includes("accounting")?"Ghi sổ":"Ghi nhận",release:kind==="accounting_periods"?"Mở kỳ":"Phát hành",complete:kind==="accounting_periods"?"Khóa kỳ":"Hoàn thành",cancel:"Hủy nháp",reverse:"Đảo chứng từ"};
 return <div className={styles.stack} data-business-unsaved={open&&(dirty||!!pending||deliveryPending||receiptPending||simulationPending||attachmentPending||extraPending)||undefined}><PageHeader title={definition.label} action={<div className={styles.actions}>{isImportKind(kind)&&canImportCatalog(w,kind)?<BusinessCatalogImport workspace={w} kind={kind} onCommitted={()=>void load()}/>:null}{businessCan(w,kind,"create")&&!generatedOnly?<Button variant="primary" onClick={()=>edit(null)}>Tạo mới</Button>:null}</div>}/><form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setPage(1);setQuery(q);}}><Input label="Tìm mã hoặc tên" maxLength={100} value={q} onChange={e=>setQ(e.target.value)}/><Button type="submit">Tìm kiếm</Button><Button onClick={()=>void load()} disabled={loading}>Tải lại</Button><BusinessColumnChooser fields={tableFields} selected={selectedColumns} onChange={setSelectedColumns} onReset={()=>setSelectedColumns(defaultRecordColumns(kind,tableFields))}/></form>
 {kind==="item_unit_conversions"&&businessCan(w,"items","read")?<BusinessItemQuantityConverter slug={w.slug}/>:null}
 <div className={styles.listSummary}><span>{total.toLocaleString("vi-VN")} bản ghi</span>{query?<span>Từ khóa: <strong>{query}</strong></span>:null}</div>
 <DataTable<Row> className={styles.recordsTable} ariaLabel={definition.label} data={rows} loading={loading} error={error} emptyTitle="Chưa có dữ liệu" getRowId={row=>row.id} columns={[
  {id:"identity",header:definition.mode==="master"?"Danh mục":"Chứng từ",priority:"primary",cell:row=><button type="button" className={styles.recordIdentity} onClick={()=>edit(row)}><strong>{row.code}</strong><span>{row.name}</span></button>},
  {id:"status",header:"Trạng thái",cell:row=><StatusBadge tone={row.status==="posted"||row.status==="completed"?"success":row.status==="cancelled"||row.status==="inactive"?"warning":row.status==="draft"?"neutral":"info"}>{recordStates[row.status]}</StatusBadge>},
  ...tableFields.filter(([key])=>selectedColumns.includes(key)).map(([key,field],index)=>({id:key,header:field.label,hiddenOnMobile:index>1,cell:(row:Row)=><span className={field.type==="number"?styles.numeric:styles.recordCell}>{recordFieldText(row,key,field)}</span>}))
 ]} actions={row=><Button onClick={()=>edit(row)}>Mở</Button>}/>
 <div className={styles.pagination}><span>{total.toLocaleString("vi-VN")} bản ghi · Trang {page}/{Math.max(1,Math.ceil(total/25))}</span><div className={styles.actions}><Button disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Trước</Button><Button disabled={loading||page*25>=total} onClick={()=>setPage(p=>p+1)}>Sau</Button></div></div>
 <Drawer open={open} className={businessDocumentDrawerClassName} size={definition.mode!=="master"||definition.lineKind||Object.keys(definition.fields).length>6?"wide":"default"}
  footer={<div className={styles.recordFooter}><StatusBadge tone={dirty?"warning":"neutral"}>{dirty?"Chưa lưu":selected?recordStates[selected.status]:"Bản nháp mới"}</StatusBadge><div className={styles.actions}>
   {reloadRecord?<Button variant="primary" busy={busy} onClick={()=>void reloadEditor()}>Tải lại chứng từ</Button>:pending&&!busy?<Button variant="primary" onClick={()=>void send(pending)}>Thử lại cùng yêu cầu</Button>:editable?<Button form={formId} type="submit" variant="primary" busy={busy} disabled={disabled||!!selected&&!dirty}>{definition.mode==="master"?"Lưu":!selected&&definition.lineKind?"Lưu nháp & thêm dòng":selected?"Lưu thay đổi":"Lưu nháp"}</Button>:null}
   {selected?.status==="draft"&&definition.mode!=="master"&&w.role!=="viewer"&&(businessCan(w,kind,definition.mode==="order"?"release":"post")||businessCan(w,kind,"approve")||!!approval?.actions.length)&&!dirty&&recordView!=="review"?<Button disabled={busy||!!pending||deliveryPending||receiptPending||attachmentPending||extraPending||simulationPending||!!reloadRecord} onClick={()=>changeRecordView("review")}>{definition.mode==="order"?"Kiểm tra & phát hành":"Kiểm tra & ghi nhận"}</Button>:null}
   {selected?.status==="released"&&kind==="purchase_orders"&&recordView!=="receiving"&&recordTabs.some(tab=>tab.value==="receiving")&&businessCan(w,"purchase_receipts","read")?<Button variant="primary" disabled={busy||!!pending||deliveryPending||receiptPending||attachmentPending||extraPending||simulationPending} onClick={()=>changeRecordView("receiving")}>Nhận hàng</Button>:null}
   <Button onClick={close} disabled={busy}>Đóng</Button>
  </div></div>}
  title={definition.label} onClose={close}>
  <BusinessDocumentWorkspace workspace={w} kind={kind} data={data} selected={selected} dirty={dirty}
   navigation={selected?<ViewTabs id={formId+"-views"} label="Chi tiết chứng từ" className={styles.viewTabs} value={recordView} onValueChange={changeRecordView} items={recordTabs}/>:undefined}
   notices={<>{notice?<div role="status"><StatusBadge tone="success">{notice}</StatusBadge></div>:null}{formError?<div ref={errorSummary} tabIndex={-1} className="form-alert form-alert--error" role="alert">{formError}</div>:null}{selected&&financial&&!approval?.required?<StatusBadge tone={selected.reviewed_by?"success":"neutral"}>{selected.reviewed_by?"Đã duyệt":"Chờ người khác duyệt"}</StatusBadge>:null}</>}>
   <div id={formId+"-views-panel"} role={selected?"tabpanel":undefined} aria-labelledby={selected?formId+"-views-"+recordView:undefined} tabIndex={selected?0:undefined} className={styles.stack}>
    <div hidden={recordView!=="information"} className={styles.stack}>
     <div data-ui="document-main"><form id={formId} noValidate onSubmit={save} className={styles.stack}><BusinessRecordFormFields workspace={w} kind={kind} recordId={recordId} data={data} selected={selected} disabled={disabled} readOnly={!recordWritable} errors={fieldErrors} onChange={changeField}/></form></div>
     {selected&&definition.lineKind&&allowed.includes(definition.lineKind)&&businessCan(w,definition.lineKind,"read")?<section data-ui="document-lines"><BusinessDocumentLines workspace={w} parentKind={kind} parentId={selected.id} parentVersion={selected.row_version} startAdding={startLineEntry} editable={businessCan(w,kind,"update")&&(selected.status==="draft"||(kind==="boms"&&selected.status==="active"))} disabled={!!reloadRecord||busy||!!pending||dirty||receiptPending||extraPending||attachmentPending} onBusyChange={setBusy} onPendingChange={setDeliveryPending} onParentUpdated={acceptParentVersion}/></section>:null}
    </div>
    <div hidden={recordView!=="lines"} className={styles.stack}>
     {open&&selected&&kind==="journal_entries"?<BusinessJournalPanel key={selected.id} slug={w.slug} journalId={selected.id} onBusyChange={setBusy} onPendingChange={setDeliveryPending} editable={recordWritable&&!selected.source_id} disabled={!!reloadRecord||busy||!!pending||dirty||receiptPending||extraPending||attachmentPending} onUpdated={acceptParentVersion}/>:null}
     {open&&selected?.posted_journal_id&&businessCan(w,"journal_entries","read")?<BusinessJournalPanel key={String(selected.posted_journal_id)} slug={w.slug} journalId={String(selected.posted_journal_id)} editable={false} onBusyChange={()=>{}} onPendingChange={()=>{}} onUpdated={()=>{}}/>:null}
     {open&&selected&&kind==="sales_orders"?<SalesFulfillmentPanel key={selected.id+":"+selected.row_version} slug={w.slug} orderId={selected.id} viewer={w.role==="viewer"} disabled={!!reloadRecord||busy||!!pending||dirty} onBusyChange={setBusy} onPendingChange={setDeliveryPending} onCommitted={()=>{void refreshAfterOperation(selected.id);}}/>:null}
    </div>
    <div hidden={recordView!=="receiving"}>{selected&&kind==="purchase_orders"&&(recordView==="receiving"||receiptPending)?<BusinessPurchaseReceiving key={selected.id} workspace={w} order={selected} disabled={!!reloadRecord||busy||!!pending||dirty||deliveryPending||extraPending||attachmentPending||simulationPending} onBusyChange={setBusy} onPendingChange={setReceiptPending} onCommitted={()=>{void load();}}/>:null}</div>
    <div hidden={recordView!=="files"} className={styles.stack}>{selected&&definition.mode!=="master"?<><BusinessExtraForm key={selected.id+"form"} slug={w.slug} kind={kind} id={selected.id} parentVersion={selected.row_version} editable={selected.status==="draft"&&businessCan(w,kind,"update")} disabled={!!reloadRecord||busy||!!pending||dirty||deliveryPending||receiptPending||simulationPending||attachmentPending} onPending={setExtraPending} onUpdated={version=>setSelected(v=>v&&version>v.row_version?{...v,row_version:version,reviewed_by:null,calculation_snapshot:null}:v)}/><BusinessAttachments key={selected.id+"attachments"} slug={w.slug} kind={kind} id={selected.id} editable={selected.status==="draft"&&businessCan(w,kind,"update")} disabled={!!reloadRecord||busy||!!pending||dirty||deliveryPending||receiptPending||extraPending} onPending={setAttachmentPending} onUpdated={version=>setSelected(v=>v&&version>v.row_version?{...v,row_version:version,reviewed_by:null,calculation_snapshot:null}:v)}/></>:null}</div>
    <div hidden={recordView!=="review"} className={styles.stack}>
     {selected?.calculation_snapshot?<BusinessCalculationPanel kind={kind} snapshot={selected.calculation_snapshot}/>:null}
     {selected&&definition.mode!=="master"?<BusinessApprovalPanel key={selected.id+"approval"} slug={w.slug} kind={kind} id={selected.id} version={selected.row_version} disabled={!!reloadRecord||busy||!!pending||dirty||deliveryPending||receiptPending||extraPending||attachmentPending} onContext={setApproval} onAction={action}/>:null}
     {w.role!=="viewer"&&actions.length?<div className={styles.stack}><Textarea label="Nội dung thao tác" rows={2} minLength={3} maxLength={500} value={reason} disabled={busy||!!pending||deliveryPending||receiptPending||simulationPending||attachmentPending||extraPending} onChange={e=>setReason(e.target.value)}/><div className={styles.actions}>{actions.map(a=><Button key={a} disabled={busy||!!pending||deliveryPending||receiptPending||simulationPending||attachmentPending||extraPending||dirty} onClick={()=>action(a)}>{actionLabels[a]}</Button>)}</div></div>:null}
    </div>
    <div hidden={recordView!=="simulation"}>{selected&&(recordView==="simulation"||simulationPending)&&w.isDemo&&definition.simulationServices?.length&&businessCan(w,kind,"report")?<BusinessSimulationPanel key={selected.id+"simulation"} slug={w.slug} kind={kind} id={selected.id} version={selected.row_version} status={selected.status} disabled={busy||!!pending||!!reloadRecord||dirty||deliveryPending||receiptPending||extraPending||attachmentPending} onPending={setSimulationPending}/>:null}</div>
    <div hidden={recordView!=="history"}>{selected&&recordView==="history"?<BusinessRecordHistory key={selected.id+"history"} slug={w.slug} kind={kind} id={selected.id} version={selected.row_version}/>:null}</div>
   </div>
   {selected&&businessCan(w,kind,"report")?<BusinessDocumentDownload key={selected.id+"pdf"} slug={w.slug} kind={kind} id={selected.id} disabled={busy||!!pending||!!reloadRecord||dirty||deliveryPending||receiptPending||extraPending||attachmentPending}/>:null}
  </BusinessDocumentWorkspace>
 </Drawer></div>;
}
