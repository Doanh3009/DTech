"use client";

import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {Plus,RefreshCw,X} from "lucide-react";
import {Button} from "@/components/shared/Button";
import {DataTable,type DataTableColumn} from "@/components/shared/DataTable";
import {Input,Select} from "@/components/shared/FormControls";
import {StatusBadge} from "@/components/shared/StatusBadge";
import {businessEntities,emptyRecord,entitiesFor,recordSchema,type EntityField,type EntityKind} from "./businessCatalog";
import {businessCan} from "./businessAccess";
import type {BusinessWorkspace} from "./businessSchemas";
import {BusinessReference} from "./BusinessReference";
import {BusinessTransactionQuantity} from "./BusinessTransactionQuantity";
import {businessDocumentColumns} from "./businessDocumentColumns";
import styles from "./Business.module.css";
import lineStyles from "./BusinessDocumentLines.module.css";

type Row=Record<string,unknown>&{id:string;name:string;row_version:number};
type Pending={url:string;body:Record<string,unknown>;recordId:string;expectedVersion:number;intent:"create"|"update"|"remove"};
type Props={workspace:BusinessWorkspace;parentKind:EntityKind;parentId:string;parentVersion:number;editable:boolean;disabled:boolean;startAdding?:boolean;onBusyChange:(value:boolean)=>void;onPendingChange:(value:boolean)=>void;onParentUpdated:(version:number,reviewedBy:string|null,origin?:"read"|"write")=>void};
function numeric(value:unknown){if(value===null||value===undefined||value==="")return undefined;const result=Number(value);return Number.isFinite(result)?result:undefined;}
function money(value:number|undefined){return value===undefined?"—":value.toLocaleString("vi-VN",{maximumFractionDigits:2,...(value!==0&&Math.abs(value)<0.01?{notation:"scientific" as const}:{})});}
function lineAmount(row:Record<string,unknown>,priceField:string){const quantity=numeric(row.quantity),price=numeric(row[priceField]);return quantity===undefined||price===undefined?undefined:quantity*price;}

export function BusinessDocumentLines({workspace:w,parentKind,parentId,parentVersion,editable,disabled,startAdding=false,onBusyChange,onPendingChange,onParentUpdated}:Props){
 const kind=businessEntities[parentKind].lineKind!,definition=businessEntities[kind],parentField=definition.parentField!,endpoint=`/api/v1/business/${w.slug}`;
 const allowed=entitiesFor(w.industry,w.features),fields=Object.entries(definition.fields).filter(([key,f])=>key!==parentField&&!f.uiHidden&&(!f.readRoles||f.readRoles.includes(w.role))&&(!f.requiresFeature||w.features.includes(f.requiresFeature))&&(!f.ref||allowed.includes(f.ref)));
 const fresh=()=>({...emptyRecord(kind,w.industry),[parentField]:parentId,code:`CT-${crypto.randomUUID()}`});
 const [rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [editorOpen,setEditorOpen]=useState(()=>startAdding&&editable&&!definition.generatedOnly&&businessCan(w,kind,"create")),[editing,setEditing]=useState<Row|null>(null),[data,setData]=useState<Record<string,unknown>>(fresh),[dirty,setDirty]=useState(false),[pending,setPending]=useState<Pending|null>(null),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const updated=useRef(onParentUpdated),loadSequence=useRef(0),inFlight=useRef(false),errorSummary=useRef<HTMLDivElement>(null),focusedEditor=useRef<string|null>(null);
 const editorId=editing?.id??`${parentId}-line`,editorFormId=`${editorId}-editor`;
 useEffect(()=>{updated.current=onParentUpdated;},[onParentUpdated]);
 const load=useCallback((signal?:AbortSignal,origin:"read"|"write"="read")=>{
  const sequence=++loadSequence.current;
  return fetch(`${endpoint}/document-lines/${parentKind}/${parentId}?page=${page}`,{cache:"no-store",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}).then(async response=>{
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message??"Chưa tải được chi tiết.");
   if(!signal?.aborted&&sequence===loadSequence.current){setLoadError("");setRows(body.data.rows);setTotal(body.data.total);updated.current(body.data.parentVersion,body.data.parentReviewedBy,origin);}
  }).catch(cause=>{if(!signal?.aborted&&sequence===loadSequence.current)setLoadError(cause instanceof Error?cause.message:"Chưa tải được chi tiết.");}).finally(()=>{if(!signal?.aborted&&sequence===loadSequence.current)setLoading(false);});
 },[endpoint,parentKind,parentId,page]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load,parentVersion]);
 useLayoutEffect(()=>{if(!editorOpen){focusedEditor.current=null;return;}if(!disabled&&!busy&&focusedEditor.current!==editorId){focusedEditor.current=editorId;document.getElementById(`${editorId}-name`)?.focus();}},[editorOpen,editorId,disabled,busy]);

 const parentAllowsEdit=editable&&!definition.generatedOnly,canCreate=parentAllowsEdit&&businessCan(w,kind,"create"),canUpdate=parentAllowsEdit&&businessCan(w,kind,"update"),canEdit=canCreate||canUpdate,locked=disabled||busy||!!pending;
 const priceField=definition.quantityEntry?.priceField??"unit_price";
 const financial=["purchase_lines","sales_lines"].includes(kind)&&fields.some(([key])=>key==="quantity")&&fields.some(([key])=>key===priceField);
 const identityField=["item_id","staff_id","request_line_id","quote_line_id","work_center_id","wbs_id","contract_line_id"].find(key=>fields.some(([candidate])=>candidate===key));
 const amounts=rows.map(row=>lineAmount(row,priceField));
 const subtotal=loading||!!loadError||amounts.some(amount=>amount===undefined)?undefined:amounts.reduce<number>((sum,amount)=>sum+(amount??0),0);
 const inputQuantity=numeric(data.entry_quantity??data.quantity),inputPrice=numeric(data.entry_price??data[priceField]);
 const inputAmount=inputQuantity===undefined||inputPrice===undefined?undefined:inputQuantity*inputPrice;
 const columns:DataTableColumn<Row>[]=[{
  id:"name",header:identityField?definition.fields[identityField].label:"Diễn giải",priority:"primary",cell:row=>{
   const reference=identityField?(row.references as Record<string,string>|undefined)?.[identityField]:undefined;
   const repeated=reference?.split(" · ").slice(1).join(" · ")===row.name;
   return <div className={lineStyles.identity}><strong>{reference??row.name}</strong>{reference&&!repeated?<span>{row.name}</span>:null}</div>;
  }
 },...businessDocumentColumns(kind,fields.filter(([key])=>key!==identityField)).map(column=>financial&&[priceField,"base_unit"].includes(column.id)?{...column,hiddenOnMobile:true}:column),...(financial?[{id:"lineAmount",header:"Thành tiền",align:"right" as const,cell:(row:Row)=><strong className={lineStyles.amount}>{money(lineAmount(row,priceField))}</strong>}]:[])];

 function change(key:string,value:unknown){
  setData(current=>({...current,[key]:value}));setDirty(true);setError("");setNotice("");onPendingChange(true);
  setFieldErrors(current=>{const next={...current};delete next[key];if(key==="quantity")delete next.entry_quantity;if(key===priceField)delete next.entry_price;return next;});
 }
 function reset(){setEditing(null);setData(fresh());setDirty(false);setPending(null);setFieldErrors({});setError("");setEditorOpen(false);onPendingChange(false);}
 function openNew(){if(!canCreate||locked)return;if(dirty&&!window.confirm("Bỏ thay đổi của dòng đang nhập?"))return;reset();setNotice("");setEditorOpen(true);}
 function edit(row:Row){
  if(!canUpdate||locked)return;if(dirty&&!window.confirm("Rời dòng chưa lưu?"))return;
  setEditing(row);setData(Object.fromEntries(Object.keys(emptyRecord(kind)).map(key=>[key,row[key]??(key==="notes"?"":null)])));setDirty(false);setPending(null);setFieldErrors({});setError("");setNotice("");setEditorOpen(true);onPendingChange(false);
 }
 function discard(){if(busy||pending)return;if(dirty&&!window.confirm("Bỏ thay đổi của dòng đang nhập?"))return;reset();}
 function showFailure(message:string){setError(message);setTimeout(()=>errorSummary.current?.focus(),0);}
 async function send(command:Pending){
  if(inFlight.current||disabled)return;inFlight.current=true;setBusy(true);onBusyChange(true);setPending(command);onPendingChange(true);setError("");setNotice("");
  try{
   const response=await fetch(command.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command.body),signal:AbortSignal.timeout(20000)});const body=await response.json();
   if(!response.ok||!body.ok){if(response.status<500&&response.status!==429){setPending(null);onPendingChange(dirty);}throw Error(body.error?.message??"Chưa lưu được dòng chi tiết.");}
   if(body.data?.recordId!==command.recordId||!Number.isInteger(body.data?.rowVersion)||body.data.rowVersion<=command.expectedVersion)throw Error("Chưa xác nhận được kết quả. Thử lại cùng yêu cầu.");
   reset();setNotice(command.intent==="remove"?"Đã bỏ dòng":command.intent==="update"?"Đã cập nhật dòng":"Đã thêm dòng");setLoading(true);await load(undefined,"write");
  }catch(cause){showFailure(cause instanceof Error?cause.message:"Chưa xác nhận được dòng chi tiết đã lưu.");}
  finally{inFlight.current=false;setBusy(false);onBusyChange(false);}
 }
 function save(){
  if(locked||!dirty||!canEdit||!businessCan(w,kind,editing?"update":"create"))return;
  const parsed=recordSchema(kind).safeParse(data);
  if(!parsed.success){
   const errors:Record<string,string>={};for(const issue of parsed.error.issues){const key=String(issue.path[0]??""),label=key==="name"?"Diễn giải":definition.fields[key]?.label??"Dữ liệu";errors[key]=/[À-ỹ]/u.test(issue.message)?issue.message:key==="name"?"Nhập diễn giải từ 2 ký tự.":`${label} chưa hợp lệ.`;}
   setFieldErrors(errors);setError("Kiểm tra các trường được đánh dấu.");
   const key=Object.keys(errors)[0],visibleKey=key==="entry_quantity"?"quantity":key==="entry_price"?priceField:key;
   setTimeout(()=>{const field=document.getElementById(`${editorId}-${visibleKey}`);if(field)field.focus();else errorSummary.current?.focus();},0);return;
  }
  setFieldErrors({});const recordId=editing?.id??crypto.randomUUID(),rowVersion=editing?.row_version??0;
  void send({url:`${endpoint}/records/${kind}`,body:{requestId:crypto.randomUUID(),recordId,rowVersion,data:parsed.data},recordId,expectedVersion:rowVersion,intent:editing?"update":"create"});
 }
 function remove(row:Row){
  if(!canUpdate||locked||dirty||!window.confirm(`Bỏ dòng “${row.name}” khỏi chứng từ?`))return;
  void send({url:`${endpoint}/records/${kind}/${row.id}/actions`,body:{requestId:crypto.randomUUID(),rowVersion:row.row_version,action:"deactivate",reason:"Bỏ dòng khỏi chứng từ nháp"},recordId:row.id,expectedVersion:row.row_version,intent:"remove"});
 }
 function field([key,f]:[string,EntityField]){
  const id=`${editorId}-${key}`,value=data[key],error=fieldErrors[key];
  if(definition.quantityEntry&&key==="quantity")return <BusinessTransactionQuantity key={key} slug={w.slug} kind={kind} recordId={editorId} data={data} selected={editing} disabled={locked} readOnly={!canEdit} errors={fieldErrors} onChange={change}/>;
  if(f.type==="ref")return <BusinessReference key={(editing?.id??"new")+key} id={id} slug={w.slug} kind={f.ref!} label={f.label} value={value?String(value):null} initialLabel={(editing?.references as Record<string,string>|undefined)?.[key]} required={f.required} disabled={locked} validationError={error} onChange={value=>change(key,value)} onSelect={option=>{if(!String(data.name??"").trim()&&["item_id","staff_id","request_line_id","quote_line_id","wbs_id"].includes(key))change("name",option.name);}}/>;
  if(f.type==="enum"||f.type==="boolean")return <Select key={key} id={id} label={f.label} error={error} value={String(value??"")} disabled={locked} required={f.required} options={f.type==="boolean"?[{value:"true",label:"Có"},{value:"false",label:"Không"}]:Object.entries(f.values!).map(([value,label])=>({value,label}))} onChange={event=>change(key,f.type==="boolean"?event.target.value==="true":event.target.value)}/>;
  return <Input key={key} id={id} label={f.label} error={error} type={f.type==="number"?"number":f.type==="date"?"date":f.type==="time"?"time":f.type==="email"?"email":"text"} min={f.min} max={f.type==="number"?f.max??1e15:undefined} maxLength={f.type==="text"?f.max??240:undefined} step={f.type==="number"?(f.integer?1:"0.0001"):undefined} required={f.required||f.default!==undefined} readOnly={f.uiReadOnly} value={value===null||value===undefined?"":String(value)} disabled={locked} onChange={event=>change(key,event.target.value===""?null:f.type==="number"?Number(event.target.value):event.target.value)}/>;
 }

 return <section className={lineStyles.workbench} aria-label={definition.label} data-ui="business-document-lines">
  <header className={lineStyles.header}><div className={lineStyles.heading}><h2>{definition.label}</h2>{!canEdit?<StatusBadge tone="neutral">Chỉ xem</StatusBadge>:null}</div><div className={lineStyles.actions}><Button size="sm" disabled={locked} leftIcon={<RefreshCw size={15} aria-hidden="true"/>} onClick={()=>{setLoading(true);setLoadError("");void load();}}>Tải lại dòng</Button>{canCreate?<Button size="sm" variant="primary" leftIcon={<Plus size={16} aria-hidden="true"/>} disabled={locked} onClick={openNew}>Thêm dòng</Button>:null}</div></header>
  {notice?<div role="status"><StatusBadge tone="success">{notice}</StatusBadge></div>:null}
  {error?<div ref={errorSummary} tabIndex={-1} role="alert" className="form-alert form-alert--error">{error}</div>:null}
  <div className={lineStyles.grid}><DataTable<Row> ariaLabel={definition.label} className={`${styles.operationalTable} ${lineStyles.table}`} loading={loading} error={loadError} data={rows} getRowId={row=>row.id} emptyTitle="Chưa có dòng chi tiết" columns={columns} actions={canUpdate?row=><div className={lineStyles.rowActions}><Button size="sm" disabled={locked} onClick={()=>edit(row)}>Sửa</Button><Button size="sm" variant="ghost" disabled={locked||dirty} onClick={()=>remove(row)}>Bỏ dòng</Button></div>:undefined}/></div>
  <div className={lineStyles.summary} role="group" aria-label="Tổng hợp chi tiết" data-ui="business-document-line-summary"><span><span>Số dòng</span><strong>{loading||loadError?"—":total.toLocaleString("vi-VN")}</strong></span>{financial?<span className={lineStyles.total}><span>{total>rows.length?"Tiền hàng trang này":"Tiền hàng"}</span><strong>{money(subtotal)}</strong></span>:null}</div>
  {total>25?<div className={styles.pagination}><span>Trang {page}/{Math.max(1,Math.ceil(total/25))}</span><div className={styles.actions}><Button disabled={locked||dirty||page<=1} onClick={()=>{setLoading(true);setPage(value=>value-1);}}>Trước</Button><Button disabled={locked||dirty||page*25>=total} onClick={()=>{setLoading(true);setPage(value=>value+1);}}>Sau</Button></div></div>:null}
  {pending&&!busy&&!editorOpen?<div className={lineStyles.actions}><Button variant="primary" disabled={disabled} onClick={()=>void send(pending)}>Thử lại cùng yêu cầu</Button></div>:null}
  {editorOpen&&canEdit&&businessCan(w,kind,editing?"update":"create")?<section className={lineStyles.editor} aria-label={editing?"Sửa dòng chứng từ":"Thêm dòng chứng từ"} data-ui="business-document-line-editor">
   <div className={lineStyles.editorHeading}><h3>{editing?"Sửa dòng":"Dòng mới"}</h3><StatusBadge tone={dirty?"warning":"neutral"}>{dirty?"Chưa lưu":editing?`Phiên bản ${editing.row_version}`:"Đang nhập"}</StatusBadge><Button variant="ghost" size="sm" aria-label="Đóng dòng đang nhập" disabled={busy||!!pending} leftIcon={<X size={16} aria-hidden="true"/>} onClick={discard}/></div>
   <form id={editorFormId} className={lineStyles.editorFields} noValidate onSubmit={event=>{event.preventDefault();save();}}><Input id={`${editorId}-name`} label="Diễn giải" error={fieldErrors.name} required value={String(data.name??"")} maxLength={180} disabled={locked} onChange={event=>change("name",event.target.value)}/>{fields.filter(([key,f])=>!f.computed&&key!==definition.quantityEntry?.priceField).map(field)}</form>
   <footer className={lineStyles.editorFooter}>{financial?<div className={lineStyles.preview}><span>Tiền hàng đang nhập</span><strong>{money(inputAmount)}</strong></div>:null}<div className={lineStyles.actions}>{pending&&!busy?<Button variant="primary" disabled={disabled} onClick={()=>void send(pending)}>Thử lại cùng yêu cầu</Button>:<Button variant="primary" form={editorFormId} type="submit" disabled={locked||!dirty} busy={busy}>{editing?"Lưu dòng":"Thêm vào chứng từ"}</Button>}<Button disabled={busy||!!pending} onClick={discard}>{editing?"Hủy sửa":"Hủy nhập"}</Button></div></footer>
  </section>:null}
 </section>;
}
