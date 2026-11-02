"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/shared/Button";
import {Input,Select} from "@/components/shared/FormControls";
import {Drawer} from "@/components/shared/Overlays";
import {DataTable} from "@/components/shared/DataTable";
import {StatusBadge} from "@/components/shared/StatusBadge";
import type {BusinessWorkspace} from "./businessSchemas";
import {businessEntities} from "./businessCatalog";
import {importColumns,importErrorLabels,importErrorsCsv,type ImportCommit,type ImportHistory,type ImportKind,type ImportPreview,type ImportPreviewRow,type ImportReceipt} from "./businessImport";
import styles from "./Business.module.css";

type Choice="skip"|"create"|"update";
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function BusinessCatalogImport({workspace:w,kind,onCommitted}:{workspace:BusinessWorkspace;kind:ImportKind;onCommitted:()=>void}){
 const endpoint=`/api/v1/business/${w.slug}/imports/${kind}`;
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<ImportPreview|null>(null),[choices,setChoices]=useState<Record<number,Choice>>({}),[result,setResult]=useState<ImportReceipt|null>(null),[pending,setPending]=useState<ImportCommit|null>(null);
 const [activity,setActivity]=useState<"template"|"preview"|"commit"|null>(null),[error,setError]=useState(""),[page,setPage]=useState(1),[history,setHistory]=useState<ImportHistory[]>([]),[historyLoading,setHistoryLoading]=useState(false),[historyError,setHistoryError]=useState(""),[fileVersion,setFileVersion]=useState(0),[duplicateChoice,setDuplicateChoice]=useState("skip");
 const busy=activity!==null;
 const running=useRef(false),summary=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(error)summary.current?.focus();},[error]);
 useEffect(()=>{if(!open)return;const controller=new AbortController();void fetch(`${endpoint}?view=history`,{cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message||"Không tải được lịch sử nhập.");setHistory(body.data);}).catch(cause=>{if(!controller.signal.aborted)setHistoryError(cause instanceof Error?cause.message:"Không tải được lịch sử nhập.");}).finally(()=>{if(!controller.signal.aborted)setHistoryLoading(false);});return()=>controller.abort();},[open,endpoint]);
 useEffect(()=>{if(!open||(!pending&&!busy))return;const handler=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);},[open,pending,busy]);
 function reset(){setFile(null);setPreview(null);setResult(null);setPending(null);setChoices({});setError("");setPage(1);setFileVersion(value=>value+1);setDuplicateChoice("skip");}
 function close(){if(busy)return;if(pending&&!window.confirm("Kết quả nhập chưa được xác nhận. Đóng cửa sổ?"))return;setOpen(false);reset();}
 async function template(){if(running.current)return;running.current=true;setActivity("template");setError("");try{const response=await fetch(`${endpoint}?view=template`,{signal:AbortSignal.timeout(20000)});if(!response.ok){const body=await response.json();throw Error(body.error?.message||"Không tải được tệp mẫu.");}download(await response.blob(),`${kind}-template.xlsx`);}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được tệp mẫu.");}finally{running.current=false;setActivity(null);}}
 async function check(){if(!file||running.current)return;running.current=true;setActivity("preview");setDuplicateChoice("skip");setError("");setResult(null);setPreview(null);setPending(null);setPage(1);try{
  const form=new FormData();form.set("file",file);const response=await fetch(endpoint,{method:"POST",body:form,signal:AbortSignal.timeout(30000)}),body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message||"Không kiểm tra được tệp.");
  const next=body.data as ImportPreview;setPreview(next);setChoices(Object.fromEntries(next.rows.map(row=>[row.rowNumber,row.errors.length||row.existing||!row.canCreate?"skip":"create"])));
  if(next.rows.some(row=>row.errors.length))setError("Tệp có dòng chưa hợp lệ. Sửa tệp hoặc bỏ qua những dòng có lỗi.");
 }catch(cause){setError(cause instanceof Error?cause.message:"Không kiểm tra được tệp.");}finally{running.current=false;setActivity(null);}}
 async function commit(command:ImportCommit){if(running.current)return;running.current=true;setActivity("commit");setError("");setPending(command);try{
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command),signal:AbortSignal.timeout(30000)}),body=await response.json();
  if(!response.ok||!body.ok){if(response.status<500&&response.status!==429)setPending(null);throw Error(body.error?.message||"Chưa xác nhận kết quả nhập. Thử lại cùng yêu cầu.");}
  const receipt=body.data as ImportReceipt;setResult(receipt);setPending(null);setPage(1);setHistory(current=>[{requestId:receipt.requestId,fileName:command.fileName,createdAt:new Date().toISOString(),created:receipt.created,updated:receipt.updated,failed:receipt.failed},...current].slice(0,20));onCommitted();
 }catch(cause){setError(cause instanceof Error?cause.message:"Chưa xác nhận kết quả nhập. Thử lại cùng yêu cầu.");}finally{running.current=false;setActivity(null);}}
 const selected=(preview?.rows??[]).filter(row=>!row.errors.length&&choices[row.rowNumber]&&choices[row.rowNumber]!=="skip");
 function confirm(){if(!preview||!selected.length||busy||pending)return;const created=selected.filter(row=>choices[row.rowNumber]==="create").length,updated=selected.length-created;if(!window.confirm(`Nhập ${selected.length} dòng: tạo ${created}, cập nhật ${updated}?`))return;
  void commit({requestId:crypto.randomUUID(),fileName:preview.fileName,fileHash:preview.fileHash,rows:selected.map(row=>({rowNumber:row.rowNumber,action:choices[row.rowNumber] as "create"|"update",recordId:row.recordId,rowVersion:row.rowVersion,data:row.data}))});
 }
 function chooseDuplicates(value:string){setDuplicateChoice(value);setChoices(current=>({...current,...Object.fromEntries((preview?.rows??[]).filter(row=>row.existing&&!row.errors.length&&row.canUpdate).map(row=>[row.rowNumber,value]))}));}
 function exportErrors(){const rows=result?result.results.filter(row=>row.status==="failed").map(row=>({rowNumber:row.rowNumber,code:row.code,errors:[importErrorLabels[row.errorCode??""]??"Không thể lưu dòng này."]})):preview?.rows??[];download(new Blob([importErrorsCsv(rows)],{type:"text/csv;charset=utf-8"}),`${kind}-errors.csv`);}
 function formatValue(column:string,previous:unknown,value:unknown,existing:boolean){const format=(v:unknown)=>businessEntities[kind].fields[column]?.values?.[String(v)]??(v===null||v===undefined||v===""?"—":typeof v==="number"?v.toLocaleString("vi-VN",{maximumFractionDigits:4}):String(v));return existing&&previous!==value?`${format(previous)} → ${format(value)}`:format(value);}
 const previewRows=preview?.rows.slice((page-1)*25,page*25)??[],results=result?.results.slice((page-1)*25,page*25)??[],total=result?.results.length??preview?.rows.length??0;
 return <><Button onClick={()=>{reset();setHistory([]);setHistoryLoading(true);setHistoryError("");setOpen(true);}}>Nhập Excel / CSV</Button>
 <Drawer open={open} title={`Nhập danh mục · ${businessEntities[kind].label}`} onClose={close} size="wide"><div className={styles.stack}>
  {error?<div className="form-alert form-alert--error" role="alert" tabIndex={-1} ref={summary}>{error}</div>:null}
  {!result?<><div className={styles.actions}><Button busy={activity==="template"} disabled={busy||!!pending} onClick={()=>void template()}>Tải tệp mẫu</Button></div><Input key={fileVersion} label="Tệp CSV / XLSX · tối đa 1 MB, 200 dòng" type="file" accept=".csv,.xlsx" disabled={busy||!!pending} onChange={event=>{setFile(event.target.files?.[0]??null);setPreview(null);setChoices({});setError("");}}/>
  <div className={styles.actions}><Button disabled={!file||busy||!!pending} busy={activity==="preview"} onClick={()=>void check()}>Kiểm tra tệp</Button></div></>:null}
  {preview&&!result?<><div className={styles.actions} role="status"><StatusBadge tone="info">{preview.rows.length} dòng</StatusBadge><StatusBadge tone="success">{preview.rows.filter(row=>!row.errors.length).length} hợp lệ</StatusBadge><StatusBadge tone="error">{preview.rows.filter(row=>row.errors.length).length} lỗi</StatusBadge><StatusBadge tone="warning">{preview.rows.filter(row=>row.existing).length} mã đã tồn tại</StatusBadge></div>
   <Select label="Áp dụng cho mã trùng" value={duplicateChoice} disabled={busy||!!pending} options={[{value:"skip",label:"Bỏ qua"},{value:"update",label:"Cập nhật dòng hợp lệ"}]} onChange={event=>chooseDuplicates(event.target.value)}/>
   <DataTable<ImportPreviewRow> className={styles.importTable} ariaLabel="Dữ liệu nhập danh mục" data={previewRows} getRowId={row=>String(row.rowNumber)} emptyDescription="" columns={[
    {id:"row",header:"Dòng",accessor:"rowNumber",width:"compact"},
    {id:"identity",header:"Danh mục",priority:"primary",cell:row=><div className={styles.importIdentity}><strong>{row.code}</strong><span>{row.name}</span></div>},
    {id:"changes",header:"Đối chiếu dữ liệu",hiddenOnMobile:true,cell:row=>{const columns=importColumns(kind).filter(column=>!["code","name"].includes(column.key)&&(row.existing?row.previousData?.[column.key]!==row.data[column.key]:row.data[column.key]!==null&&row.data[column.key]!==undefined&&row.data[column.key]!==""));return columns.length?<dl className={styles.importComparison}>{columns.map(column=><div key={column.key}><dt>{column.label}</dt><dd className={businessEntities[kind].fields[column.key]?.type==="number"?styles.importNumber:undefined}>{formatValue(column.key,row.previousData?.[column.key],row.data[column.key],row.existing)}</dd></div>)}</dl>:"Không đổi";}},
    {id:"state",header:"Kết quả kiểm tra",cell:row=>row.errors.length?<ul className={styles.importErrors}>{row.errors.map(message=><li key={message}>{message}</li>)}</ul>:<StatusBadge tone={row.existing?"warning":"success"}>{row.existing?"Mã đã tồn tại":"Hợp lệ"}</StatusBadge>}
   ]} actions={row=><Select label={"Thao tác dòng "+row.rowNumber} labelHidden value={choices[row.rowNumber]??"skip"} disabled={busy||!!pending||!!row.errors.length} options={[{value:"skip",label:"Bỏ qua"},...(!row.errors.length&&(row.existing?row.canUpdate:row.canCreate)?[{value:row.existing?"update":"create",label:row.existing?"Cập nhật":"Tạo mới"}]:[])]} onChange={event=>setChoices(current=>({...current,[row.rowNumber]:event.target.value as Choice}))}/>}/>
   <div className={styles.actions}><Button disabled={busy||!!pending||!preview.rows.some(row=>row.errors.length)} onClick={exportErrors}>Tải lỗi CSV</Button><Button variant="primary" disabled={busy||!!pending||!selected.length} busy={busy&&!!pending} onClick={confirm}>Nhập {selected.length} dòng đã chọn</Button></div>
  </>:null}
  {pending&&!busy?<Button variant="primary" onClick={()=>void commit(pending)}>Thử lại cùng yêu cầu</Button>:null}
  {result?<><div className={styles.actions} role="status"><StatusBadge tone="success">Đã tạo {result.created}</StatusBadge><StatusBadge tone="info">Đã cập nhật {result.updated}</StatusBadge><StatusBadge tone="error">Không thành công {result.failed}</StatusBadge></div>
   <DataTable data={results} getRowId={row=>String(row.rowNumber)} ariaLabel="Kết quả nhập danh mục" emptyDescription="" columns={[{id:"row",header:"Dòng",accessor:"rowNumber"},{id:"code",header:"Mã",accessor:"code",priority:"primary"},{id:"status",header:"Kết quả",cell:row=>row.status==="failed"?<span className={styles.importErrorText}>{importErrorLabels[row.errorCode??""]??"Không thể lưu dòng này."}</span>:<StatusBadge tone="success">{row.status==="created"?"Đã tạo":"Đã cập nhật"}</StatusBadge>}]}/>
   <div className={styles.actions}>{result.failed?<Button onClick={exportErrors}>Tải lỗi CSV</Button>:null}<Button onClick={reset}>Nhập tệp khác</Button></div></>:null}
  {total>25?<div className={styles.pagination}><span>Trang {page}/{Math.ceil(total/25)}</span><div className={styles.actions}><Button disabled={page<=1||busy} onClick={()=>setPage(value=>value-1)}>Trước</Button><Button disabled={page*25>=total||busy} onClick={()=>setPage(value=>value+1)}>Sau</Button></div></div>:null}
  <section className={styles.stack}><h3>Lịch sử nhập</h3><DataTable data={history} loading={historyLoading} error={historyError} getRowId={row=>row.requestId} ariaLabel="Lịch sử nhập danh mục" emptyTitle="Chưa có lịch sử nhập" emptyDescription="" columns={[{id:"file",header:"Tệp",accessor:"fileName",priority:"primary"},{id:"date",header:"Thời điểm",cell:row=>new Date(row.createdAt).toLocaleString("vi-VN")},{id:"created",header:"Tạo",accessor:"created"},{id:"updated",header:"Cập nhật",accessor:"updated"},{id:"failed",header:"Lỗi",accessor:"failed"}]}/></section>
  <div className={styles.actions}><Button disabled={busy} onClick={close}>Đóng</Button></div>
 </div></Drawer></>;
}
