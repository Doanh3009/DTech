"use client";
import{useEffect,useRef,useState}from"react";
import{FileDown}from"lucide-react";
import{Button}from"@/components/shared/Button";
import type{EntityKind}from"./businessCatalog";
import styles from"./Business.module.css";
export function BusinessDocumentDownload({slug,kind,id,disabled}:{slug:string;kind:EntityKind;id:string;disabled:boolean}){
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState(""),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function download(){if(controller.current)return;const request=new AbortController();controller.current=request;setBusy(true);setError("");setStatus("");try{const response=await fetch(`/api/v1/business/${slug}/records/${kind}/${id}/pdf`,{cache:"no-store",signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});if(!response.ok){const body=await response.json().catch(()=>null);throw Error(body?.error?.message??"Chưa tạo được PDF.");}if(!response.headers.get("content-type")?.startsWith("application/pdf"))throw Error("Tệp PDF chưa hợp lệ.");const blob=await response.blob();if(request.signal.aborted)return;const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`${kind}-${id}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("Đã tải PDF");}catch(cause){if(!request.signal.aborted)setError(cause instanceof Error?cause.message:"Chưa tải được PDF.");}finally{controller.current=null;if(!request.signal.aborted)setBusy(false);}}
 return <div className={styles.actions}><Button disabled={disabled} busy={busy} onClick={()=>void download()} leftIcon={<FileDown size={16} aria-hidden="true"/>}>Tải PDF</Button>{error?<span role="alert">{error}</span>:null}{status?<span role="status">{status}</span>:null}</div>;
}
