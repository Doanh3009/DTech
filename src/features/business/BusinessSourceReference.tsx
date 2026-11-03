"use client";
import {useEffect,useRef,useState} from "react";
import {Input,Select} from "@/components/shared/FormControls";
import {StatusBadge} from "@/components/shared/StatusBadge";
import {BusinessReference} from "./BusinessReference";
import type {EntityKind} from "./businessCatalog";

export function BusinessSourceReference({slug,kind,id,fieldKey,label,value,initialLabel,statuses,required,disabled,error,versionField,onChange}:{slug:string;kind:EntityKind;id:string;fieldKey:string;label:string;value:string|null;initialLabel?:string;statuses?:string[];required?:boolean;disabled:boolean;error?:string;versionField?:string;onChange:(key:string,value:unknown)=>void}){
 const controller=useRef<AbortController|null>(null),[loading,setLoading]=useState(false),[loadError,setLoadError]=useState("");
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function select(recordId:string){
  if(!versionField)return;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setLoadError("");
  try{const response=await fetch(`/api/v1/business/${slug}/records/${kind}/${recordId}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message??"Không tải được phiên bản nguồn.");if(!c.signal.aborted)onChange(versionField,body.data.row_version);}
  catch(error){if(!c.signal.aborted)setLoadError(error instanceof Error?error.message:"Không tải được phiên bản nguồn.");}finally{if(!c.signal.aborted)setLoading(false);}
 }
 return <div><BusinessReference slug={slug} kind={kind} id={id} label={label} value={value} initialLabel={initialLabel} statuses={statuses} required={required} disabled={disabled} validationError={error||loadError} onChange={value=>{controller.current?.abort();setLoading(false);setLoadError("");onChange(fieldKey,value);if(versionField){onChange(versionField,null);onChange("source_attachment_id",null);}}} onSelect={option=>void select(option.id)}/>{loading?<StatusBadge tone="neutral">Đang lấy phiên bản</StatusBadge>:null}</div>;
}

export function BusinessAttachmentReference({slug,kind,recordId,id,label,value,required,disabled,error,onChange}:{slug:string;kind?:EntityKind;recordId:string|null;id:string;label:string;value:string|null;required?:boolean;disabled:boolean;error?:string;onChange:(value:string|null)=>void}){
 const sourceKey=`${slug}:${kind}:${recordId}`,[result,setResult]=useState<{key:string;files:{id:string;name:string}[];error:string}|null>(null),loading=!!kind&&!!recordId&&result?.key!==sourceKey,files=result?.key===sourceKey?result.files:[],loadError=result?.key===sourceKey?result.error:"";
 useEffect(()=>{if(!kind||!recordId)return;const c=new AbortController();fetch(`/api/v1/business/${slug}/attachments/${kind}/${recordId}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async response=>{const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message??"Không tải được tệp nguồn.");if(!c.signal.aborted)setResult({key:sourceKey,files:body.data.files,error:""});}).catch(error=>{if(!c.signal.aborted)setResult({key:sourceKey,files:[],error:error instanceof Error?error.message:"Không tải được tệp nguồn."});});return()=>c.abort();},[slug,kind,recordId,sourceKey]);
 if(disabled)return <Input id={id} label={label} readOnly value={files.find(file=>file.id===value)?.name??(loading?"Đang tải…":"—")} error={error||loadError}/>;
 return <Select id={id} label={label} value={value??""} required={required} disabled={loading||!kind||!recordId} error={error||loadError} options={[{value:"",label:loading?"Đang tải…":!recordId?"Chọn chứng từ nguồn":files.length?"Chọn tệp":"Chưa có tệp nguồn"},...files.map(file=>({value:file.id,label:file.name}))]} onChange={event=>onChange(event.target.value||null)}/>;
}
