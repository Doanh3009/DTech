"use client";

import {useCallback,useEffect,useId,useMemo,useRef,useState,type FormEvent} from "react";
import {Button} from "@/components/shared/Button";
import {DataTable} from "@/components/shared/DataTable";
import {Input,Select,Textarea} from "@/components/shared/FormControls";
import {StatusBadge} from "@/components/shared/StatusBadge";
import {BusinessApprovalPanel,type ApprovalContext} from "./BusinessApprovalPanel";
import {businessCan,businessCanReport} from "./businessAccess";
import {BusinessMetricValue} from "./BusinessMetricValue";
import {BusinessReference} from "./BusinessReference";
import {businessToday} from "./businessRecordDefaults";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./BusinessPurchaseReceiving.module.css";

type PurchaseOrder=Record<string,unknown>&{id:string;code:string;status:string;row_version:number};
type PurchaseLine=Record<string,unknown>&{id:string;item_id:string;name:string;quantity:number;unit_price?:number;references?:Record<string,string>};
type Receipt=Record<string,unknown>&{id:string;code:string;status:string;row_version:number;purchase_order_id:string;item_id:string;quantity:number;unit_cost:number;references?:Record<string,string>};
type Match={id:string;ordered:number;received_agreed:number;received_actual:number;invoiced:number|null;payable:number|null};
type Item={id:string;unit:string;tracking:string};
type Values={itemId:string;quantity:string;price:string;warehouseId:string|null;lotId:string|null;date:string;notes:string};
type Command={url:string;recordId:string;operation:string;body:Record<string,unknown>};
export interface BusinessPurchaseReceivingProps{workspace:BusinessWorkspace;order:PurchaseOrder;disabled:boolean;onPendingChange:(value:boolean)=>void;onBusyChange?:(value:boolean)=>void;onCommitted?:()=>void}
const maxRows=1000;
const emptyLines:PurchaseLine[]=[];
const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value);
const format=(value:unknown)=>number(value)?Number(value).toLocaleString("vi-VN",{maximumFractionDigits:4}):"—";

async function readData(url:string,signal?:AbortSignal){
 const response=await fetch(url,{cache:"no-store",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 const body=await response.json();
 if(!response.ok||!body.ok)throw Error(body.error?.message??"Chưa tải được dữ liệu nhận hàng.");
 return body.data;
}

export function BusinessPurchaseReceiving(props:BusinessPurchaseReceivingProps){return <PurchaseReceivingSession key={`${props.workspace.slug}:${props.order.id}`} {...props}/>;}

function PurchaseReceivingSession({workspace:w,order,disabled,onPendingChange,onBusyChange,onCommitted}:BusinessPurchaseReceivingProps){
 const endpoint=`/api/v1/business/${w.slug}`,formId=useId();
 const fresh=():Values=>({itemId:"",quantity:"",price:"",warehouseId:null,lotId:null,date:businessToday(),notes:""});
 const [lineResult,setLineResult]=useState<{key:string;rows:PurchaseLine[];error:string}|null>(null);
 const [matchingResult,setMatchingResult]=useState<{key:string;match:Match|null;message:string}|null>(null);
 const [values,setValues]=useState<Values>(fresh),[itemResult,setItemResult]=useState<{key:string;item:Item|null;error:string}|null>(null);
 const [receipt,setReceipt]=useState<Receipt|null>(null),[editingReceipt,setEditingReceipt]=useState<Receipt|null>(null),[approval,setApproval]=useState<ApprovalContext|null>(null),[pending,setPending]=useState<Command|null>(null),[reloadRecord,setReloadRecord]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0),[receiptRevision,setReceiptRevision]=useState(0),[errors,setErrors]=useState<Record<string,string>>({});
 const running=useRef(false),mounted=useRef(true),report=useRef(onPendingChange),busyReport=useRef(onBusyChange),committed=useRef(onCommitted);
 useEffect(()=>{report.current=onPendingChange;busyReport.current=onBusyChange;committed.current=onCommitted;},[onPendingChange,onBusyChange,onCommitted]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;report.current(false);if(running.current)busyReport.current?.(false);};},[]);
 const unsettled=dirty||busy||!!pending||!!reloadRecord;
 useEffect(()=>{report.current(unsettled);},[unsettled]);
 const canReadLines=businessCan(w,"purchase_lines","read"),canReport=businessCanReport(w,["purchasing","inventory","accounting"]);
 const canCreate=w.features.includes("purchasing")&&w.features.includes("inventory")&&businessCan(w,"purchase_receipts","create")&&businessCan(w,"purchase_receipts","read")&&canReadLines&&businessCan(w,"items","read")&&businessCan(w,"warehouses","read");
 const canReceive=canCreate&&order.status==="released";
 const locked=disabled||busy||!!pending||!!reloadRecord;
 const lineKey=`${endpoint}:${order.id}:${order.row_version}:${revision}:${canReadLines}`,matchingKey=`${endpoint}:${order.id}:${order.code}:${order.status}:${revision}:${canReport}`,itemKey=`${endpoint}:${values.itemId}`;
 const lines=lineResult?.key===lineKey?lineResult.rows:emptyLines,linesLoading=canReadLines&&lineResult?.key!==lineKey,linesError=!canReadLines?"Không có quyền xem dòng đặt mua.":lineResult?.key===lineKey?lineResult.error:"";
 const matching=matchingResult?.key===matchingKey?matchingResult.match:null,matchingLoading=canReport&&["released","completed"].includes(order.status)&&matchingResult?.key!==matchingKey;
 const matchingState=!canReport?"Đối chiếu tổng hợp không khả dụng với quyền hiện tại.":!["released","completed"].includes(order.status)?"Đơn mua chưa phát hành.":matchingResult?.key===matchingKey?matchingResult.message:"";
 const item=itemResult?.key===itemKey?itemResult.item:null,itemLoading=!!values.itemId&&!receipt&&itemResult?.key!==itemKey,itemError=itemResult?.key===itemKey?itemResult.error:"";

 useEffect(()=>{
  const controller=new AbortController();
  if(!canReadLines)return()=>controller.abort();
  async function load(){try{
   const collected:PurchaseLine[]=[];let total:number|undefined,version:number|undefined;
   for(let page=1;page<=maxRows/25;page++){
    const data=await readData(`${endpoint}/document-lines/purchase_orders/${order.id}?page=${page}`,controller.signal);
    if(!Array.isArray(data.rows)||!Number.isInteger(data.total)||data.total<0||data.total>maxRows||!Number.isInteger(data.parentVersion))throw Error(data.total>maxRows?"Đơn mua vượt giới hạn 1.000 dòng của màn hình nhận hàng.":"Chưa xác nhận được các dòng đặt mua.");
    if(total!==undefined&&(data.total!==total||data.parentVersion!==version))throw Error("Đơn mua đã thay đổi. Tải lại các dòng đặt mua.");
    const pageTotal:number=data.total;total=pageTotal;version=data.parentVersion;
    if(data.rows.some((row:PurchaseLine)=>!row.id||!row.item_id||!number(row.quantity)))throw Error("Dòng đặt mua chưa hợp lệ.");
    collected.push(...data.rows);
    if(collected.length>=pageTotal)break;
    if(data.rows.length!==25)throw Error("Chưa tải đủ các dòng đặt mua.");
   }
   if(collected.length!==total||new Set(collected.map(row=>row.id)).size!==total)throw Error("Chưa tải đủ các dòng đặt mua.");
   if(!controller.signal.aborted)setLineResult({key:lineKey,rows:collected,error:""});
  }catch(cause){if(!controller.signal.aborted)setLineResult({key:lineKey,rows:[],error:cause instanceof Error?cause.message:"Chưa tải được dòng đặt mua."});}}
  void load();return()=>controller.abort();
 },[endpoint,order.id,canReadLines,lineKey]);

 useEffect(()=>{
  const controller=new AbortController();
  if(!canReport||!["released","completed"].includes(order.status))return()=>controller.abort();
  async function load(){try{
   for(let page=1;page<=maxRows/25;page++){
    const data=await readData(`${endpoint}/procurement?page=${page}&q=${encodeURIComponent(order.code)}`,controller.signal);
    if(!Array.isArray(data.rows)||!Number.isInteger(data.totals?.count)||data.totals.count<0||data.totals.count>maxRows)throw Error("Chưa xác nhận được số liệu đối chiếu của đơn mua.");
    const found=data.rows.find((row:Match)=>row.id===order.id);
    if(found){if(!number(found.ordered)||!number(found.received_agreed)||!number(found.received_actual))throw Error("Số liệu đối chiếu chưa hợp lệ.");if(!controller.signal.aborted)setMatchingResult({key:matchingKey,match:found,message:""});return;}
    if(page*25>=data.totals.count)break;
    if(data.rows.length!==25)throw Error("Chưa tải đủ số liệu đối chiếu.");
   }
   if(!controller.signal.aborted)setMatchingResult({key:matchingKey,match:null,message:"Chưa có số liệu đối chiếu cho đơn mua này."});
  }catch(cause){if(!controller.signal.aborted)setMatchingResult({key:matchingKey,match:null,message:cause instanceof Error?cause.message:"Chưa tải được đối chiếu."});}}
  void load();return()=>controller.abort();
 },[endpoint,order.id,order.code,order.status,canReport,matchingKey]);

 useEffect(()=>{
  const controller=new AbortController();
  if(receipt||!values.itemId)return()=>controller.abort();
  readData(`${endpoint}/records/items/${values.itemId}`,controller.signal).then(data=>{
   if(data.id!==values.itemId||typeof data.unit!=="string"||!data.unit.trim())throw Error("Chưa xác nhận được đơn vị cơ sở của vật tư.");
   if(!controller.signal.aborted)setItemResult({key:itemKey,item:data,error:""});
  }).catch(cause=>{if(!controller.signal.aborted)setItemResult({key:itemKey,item:null,error:cause instanceof Error?cause.message:"Chưa tải được đơn vị cơ sở."});});
  return()=>controller.abort();
 },[endpoint,values.itemId,receipt,itemKey]);

 const itemOptions=useMemo(()=>{
  const seen=new Set<string>();return lines.filter(line=>{if(seen.has(line.item_id))return false;seen.add(line.item_id);return true;}).map(line=>({value:line.item_id,label:line.references?.item_id??line.name}));
 },[lines]);
 const change=<K extends keyof Values>(key:K,value:Values[K])=>{setValues(current=>({...current,[key]:value}));setDirty(true);setErrors(current=>({...current,[key]:""}));setError("");setNotice("");};
 function chooseItem(itemId:string){
  const first=lines.find(line=>line.item_id===itemId);setValues(current=>({...current,itemId,quantity:"",price:first&&number(first.unit_price)?String(first.unit_price):"",lotId:null}));setDirty(true);setErrors({});setError("");
 }

 const confirmReceipt=useCallback(async(id:string)=>{
  const data=await readData(`${endpoint}/records/purchase_receipts/${id}`);
  if(!mounted.current)return;
  if(data.id!==id||data.purchase_order_id!==order.id||!Number.isInteger(data.row_version)||data.row_version<1||!["draft","posted","cancelled"].includes(data.status))throw Error("Chưa xác nhận được phiếu nhận. Tải lại phiếu để tiếp tục.");
  setReceipt(data);setEditingReceipt(null);setApproval(null);setReceiptRevision(value=>value+1);setReloadRecord(null);setError("");setNotice(data.status==="posted"?"Đã nhận vào kho":data.status==="cancelled"?"Phiếu nhận đã hủy":"Đã lưu phiếu nhận nháp");setRevision(value=>value+1);committed.current?.();
 },[endpoint,order.id]);

 async function execute(command:Command){
  if(running.current||disabled)return;running.current=true;setBusy(true);busyReport.current?.(true);setPending(command);setError("");setNotice("");
  try{
   const response=await fetch(command.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command.body),signal:AbortSignal.timeout(20000)});const body=await response.json();
   if(!response.ok||!body.ok){
    if(response.status<500&&response.status!==429){setPending(null);if(command.operation!=="save")setReloadRecord(command.recordId);}
    throw Error(body.error?.message??"Chưa xác nhận được thao tác nhận hàng.");
   }
   if(body.data?.recordId&&body.data.recordId!==command.recordId)throw Error("Chưa xác nhận được kết quả thao tác. Thử lại cùng yêu cầu.");
   if(!mounted.current)return;
   setPending(null);setDirty(false);setReloadRecord(command.recordId);await confirmReceipt(command.recordId);
  }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Chưa xác nhận được kết quả. Thử lại cùng yêu cầu.");}
  finally{running.current=false;if(mounted.current){setBusy(false);busyReport.current?.(false);}}
 }
 async function reloadConfirmation(id=reloadRecord){
  if(!id||running.current||disabled)return;running.current=true;setBusy(true);busyReport.current?.(true);setReloadRecord(id);setError("");
  try{await confirmReceipt(id);}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Chưa tải được phiếu nhận.");}
  finally{running.current=false;if(mounted.current){setBusy(false);busyReport.current?.(false);}}
 }
 function save(event:FormEvent){
  event.preventDefault();if(!canReceive||locked||receipt||itemLoading||linesLoading||!item||itemError||linesError)return;
  const next:Record<string,string>={},quantity=Number(values.quantity),price=Number(values.price);
  if(!lines.some(line=>line.item_id===values.itemId)||item.id!==values.itemId)next.itemId="Chọn vật tư trong đơn mua.";
  if(!values.quantity||!Number.isFinite(quantity)||quantity<0.0001||quantity>1e15||Math.round(quantity*10000)/10000!==quantity)next.quantity="Nhập số lượng nhận hợp lệ.";
  if(item.tracking==="serial"&&!Number.isInteger(quantity))next.quantity="Số lượng theo số sê-ri phải là số nguyên.";
  if(values.price===""||!Number.isFinite(price)||price<0||price>1e15)next.price="Nhập đơn giá nhận hợp lệ.";
  if(!values.warehouseId)next.warehouseId="Chọn kho nhận.";
  if(item.tracking!=="none"&&!values.lotId)next.lotId="Chọn lô hàng.";
  const orderDate=typeof order.order_date==="string"?order.order_date:"";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(values.date)||Number.isNaN(Date.parse(values.date))||new Date(values.date).toISOString().slice(0,10)!==values.date||values.date>businessToday()||!!orderDate&&values.date<orderDate)next.date="Ngày nhận phải từ ngày đặt mua đến hôm nay.";
  setErrors(next);if(Object.keys(next).length){setError("Kiểm tra các trường được đánh dấu.");setTimeout(()=>document.getElementById(formId+"-"+Object.keys(next)[0])?.focus(),0);return;}
  if(editingReceipt&&!businessCan(w,"purchase_receipts","update"))return;
  const recordId=editingReceipt?.id??crypto.randomUUID();
  // Explicit legacy fields keep this panel compatible with the deployed API.
  const data={code:editingReceipt?.code??"",name:editingReceipt?String(editingReceipt.name??`Nhận hàng · ${order.code}`):`Nhận hàng · ${order.code}`.slice(0,180),notes:values.notes,purchase_order_id:order.id,item_id:values.itemId,warehouse_id:values.warehouseId,lot_id:values.lotId,quantity,unit_cost:price,document_date:values.date};
  void execute({url:`${endpoint}/records/purchase_receipts`,recordId,operation:"save",body:{requestId:crypto.randomUUID(),recordId,rowVersion:editingReceipt?.row_version??0,...(!editingReceipt?{autoNumber:true}:{}),data}});
 }
 const currentApproval=!!receipt&&approval?.documentVersion===receipt.row_version;
 const canPost=canReceive&&!!receipt&&receipt.status==="draft"&&businessCan(w,"purchase_receipts","post")&&currentApproval&&(!approval?.required||approval.status==="approved"&&!approval.stale);
 function act(action:string,reason:string){
  if(!receipt||locked||!currentApproval)return;
  if(action==="post"?!canPost:!approval?.actions.includes(action))return;
  void execute({url:`${endpoint}/records/purchase_receipts/${receipt.id}/actions`,recordId:receipt.id,operation:action,body:{requestId:crypto.randomUUID(),rowVersion:receipt.row_version,action,reason}});
 }
 function editReceipt(){
  if(!receipt||locked||!canReceive||!businessCan(w,"purchase_receipts","update"))return;
  setEditingReceipt(receipt);setValues({itemId:receipt.item_id,quantity:String(receipt.quantity),price:String(receipt.unit_cost),warehouseId:typeof receipt.warehouse_id==="string"?receipt.warehouse_id:null,lotId:typeof receipt.lot_id==="string"?receipt.lot_id:null,date:typeof receipt.document_date==="string"?receipt.document_date:businessToday(),notes:String(receipt.notes??"")});setReceipt(null);setApproval(null);setErrors({});setDirty(false);setNotice("");setError("");
 }
 function cancelEdit(){if(locked||!editingReceipt)return;if(dirty&&!window.confirm("Bỏ thay đổi của phiếu nhận?"))return;setReceipt(editingReceipt);setEditingReceipt(null);setApproval(null);setDirty(false);setErrors({});setError("");}
 function nextReceipt(){if(locked)return;setReceipt(null);setEditingReceipt(null);setApproval(null);setValues(fresh());setErrors({});setDirty(false);setNotice("");setError("");}

 return <section className={styles.panel} aria-label="Nhận hàng theo đơn mua">
  <div className={styles.heading}><h2>Nhận hàng & đối chiếu</h2><Button disabled={locked} onClick={()=>setRevision(value=>value+1)}>Cập nhật nhận hàng</Button></div>
  {matching?<dl className={styles.metrics}>{[{label:"Giá trị đặt mua",value:matching.ordered},{label:"Đã nhận theo giá đặt",value:matching.received_agreed},{label:"Giá trị nhận thực tế",value:matching.received_actual},...(w.features.includes("accounting")?[{label:"Hóa đơn trước thuế",value:matching.invoiced},{label:"Phải trả còn lại",value:matching.payable}]:[])].map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd><BusinessMetricValue value={metric.value} currency/></dd></div>)}</dl>:<div role="status" className={styles.state}>{matchingLoading?"Đang tải đối chiếu…":matchingState}</div>}
  <DataTable<PurchaseLine> ariaLabel="Các dòng đặt mua được phép xem" data={lines} getRowId={line=>line.id} loading={linesLoading} error={linesError} emptyTitle="Chưa có dòng đặt mua" columns={[{id:"item",header:"Vật tư",priority:"primary",cell:line=>line.references?.item_id??line.name},{id:"quantity",header:"Số lượng đặt",cell:line=>format(line.quantity)},{id:"price",header:"Đơn giá đặt",cell:line=>format(line.unit_price)}]}/>
  {error?<div role="alert" className="form-alert form-alert--error">{error}</div>:null}
  {notice?<div role="status"><StatusBadge tone={receipt?.status==="posted"?"success":"neutral"}>{notice}</StatusBadge></div>:null}
  {reloadRecord?<Button disabled={disabled} busy={busy} onClick={()=>void reloadConfirmation()}>Tải lại phiếu nhận</Button>:pending?<Button disabled={disabled} busy={busy} onClick={()=>void execute(pending)}>Thử lại cùng yêu cầu</Button>:null}
  {receipt?<div className={styles.receipt}>
   <div className={styles.heading}><h3>{receipt.code}</h3><StatusBadge tone={receipt.status==="posted"?"success":receipt.status==="cancelled"?"warning":"neutral"}>{receipt.status==="posted"?"Đã ghi nhận":receipt.status==="cancelled"?"Đã hủy":"Nháp"}</StatusBadge></div>
   <dl className={styles.facts}><div><dt>Vật tư</dt><dd>{receipt.references?.item_id??itemOptions.find(option=>option.value===receipt.item_id)?.label??"—"}</dd></div><div><dt>Số lượng nhận</dt><dd>{format(receipt.quantity)} {item?.unit??""}</dd></div><div><dt>Đơn giá nhận</dt><dd>{format(receipt.unit_cost)}</dd></div><div><dt>Kho nhận</dt><dd>{receipt.references?.warehouse_id??"—"}</dd></div></dl>
   {receipt.status==="draft"&&!reloadRecord?<><BusinessApprovalPanel key={`${receipt.id}:${receipt.row_version}:${receiptRevision}`} slug={w.slug} kind="purchase_receipts" id={receipt.id} version={receipt.row_version} disabled={locked} onContext={context=>setApproval(context.documentVersion===receipt.row_version?context:null)} onAction={act}/><div className={styles.actions}>{canPost?<Button variant="primary" disabled={locked} onClick={()=>act("post",`Nhận hàng theo đơn ${order.code}`)}>Nhận vào kho</Button>:null}{canReceive&&businessCan(w,"purchase_receipts","update")?<Button disabled={locked} onClick={editReceipt}>Sửa phiếu nhận</Button>:null}<Button disabled={locked} onClick={()=>void reloadConfirmation(receipt.id)}>Tải trạng thái phiếu</Button></div></>:null}
   {["posted","cancelled"].includes(receipt.status)?<Button disabled={locked||!canReceive} onClick={nextReceipt}>Nhận tiếp mặt hàng</Button>:null}
  </div>:canReceive?<form id={formId} onSubmit={save} noValidate className={styles.form} aria-label={editingReceipt?"Sửa phiếu nhận":"Nhận một mặt hàng"}>
   <h3>{editingReceipt?"Sửa "+editingReceipt.code:"Nhận một mặt hàng"}</h3><fieldset disabled={locked} className={styles.fields}>
    <Select id={formId+"-itemId"} label="Vật tư nhận" value={values.itemId} placeholder="Chọn vật tư trong đơn mua" options={itemOptions} disabled={locked||linesLoading||!!linesError} error={errors.itemId} required onChange={event=>chooseItem(event.target.value)}/>
    <Input label="Đơn vị cơ sở" readOnly value={itemLoading?"Đang tải…":item?.unit??"—"} error={itemError}/>
    <Input id={formId+"-quantity"} label="Số lượng nhận" type="number" min={0.0001} max={1e15} step="0.0001" required value={values.quantity} error={errors.quantity} disabled={locked} onChange={event=>change("quantity",event.target.value)}/>
    <Input id={formId+"-price"} label="Đơn giá nhận" type="number" min={0} max={1e15} step="0.0001" required value={values.price} error={errors.price} disabled={locked} onChange={event=>change("price",event.target.value)}/>
    <BusinessReference slug={w.slug} kind="warehouses" id={formId+"-warehouseId"} label="Kho nhận" required value={values.warehouseId} disabled={locked} validationError={errors.warehouseId} onChange={value=>change("warehouseId",value)}/>
    <BusinessReference key={values.itemId+"-lot"} slug={w.slug} kind="lots" id={formId+"-lotId"} label="Lô hàng" required={!!item&&item.tracking!=="none"} value={values.lotId} disabled={locked||!values.itemId} validationError={errors.lotId} onChange={value=>change("lotId",value)}/>
    <Input id={formId+"-date"} label="Ngày nhận" type="date" min={typeof order.order_date==="string"?order.order_date:undefined} max={businessToday()} required value={values.date} error={errors.date} disabled={locked} onChange={event=>change("date",event.target.value)}/>
    <div className={styles.full}><Textarea label="Ghi chú nhận hàng" rows={2} maxLength={2000} value={values.notes} disabled={locked} onChange={event=>change("notes",event.target.value)}/></div>
   </fieldset><div className={styles.actions}><Button variant="primary" type="submit" disabled={locked||linesLoading||itemLoading||!item||!!itemError||!!linesError||!dirty} busy={busy}>{editingReceipt?"Lưu thay đổi phiếu nhận":"Lưu phiếu nhận nháp"}</Button>{editingReceipt?<Button disabled={locked} onClick={cancelEdit}>Hủy chỉnh sửa</Button>:null}</div>
  </form>:<div role="status" className={styles.state}><StatusBadge tone="neutral">{order.status!=="released"?order.status==="completed"?"Đơn mua đã hoàn thành":"Đơn mua chưa phát hành":"Chỉ xem nhận hàng"}</StatusBadge></div>}
 </section>;
}
