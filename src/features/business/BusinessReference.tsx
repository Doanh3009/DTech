"use client";
import { useEffect, useState } from "react";
import { Combobox } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { EntityKind } from "./businessCatalog";
type Option={id:string;code:string;name:string};
export function BusinessReference({slug,kind,label,value,initialLabel,required,disabled,onChange}:{slug:string;kind:EntityKind;label:string;value:string|null;initialLabel?:string;required?:boolean;disabled:boolean;onChange:(value:string|null)=>void}){
 const [text,setText]=useState(initialLabel??"");const [query,setQuery]=useState("");const [options,setOptions]=useState<Option[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [truncated,setTruncated]=useState(false);
 useEffect(()=>{if(disabled)return;const c=new AbortController();const timer=setTimeout(()=>{setLoading(true);setError("");const params=new URLSearchParams({q:query});if(value)params.set("selected",value);fetch(`/api/v1/business/${slug}/options/${kind}?${params}`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw new Error(b.error?.message);setOptions(b.data.options);setTruncated(b.data.truncated);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải danh mục.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},200);return()=>{clearTimeout(timer);c.abort();};},[slug,kind,query,value,disabled]);
 return <div><Combobox label={label} required={required} disabled={disabled} maxLength={240} value={text} error={error} aria-busy={loading} options={options.map(o=>({value:o.id,label:`${o.code} · ${o.name}`}))} onChange={e=>{const next=e.target.value;setText(next);const choice=options.find(o=>`${o.code} · ${o.name}`===next);onChange(choice?.id??null);setQuery(choice?"":next.slice(0,100));}}/>{truncated?<StatusBadge tone="neutral">100+ kết quả</StatusBadge>:null}</div>;
}
