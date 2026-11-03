"use client";
import {useEffect,useRef,useState} from "react";
import {Search} from "lucide-react";
import {BusinessLink as Link} from "./BusinessLink";
import {featureLabels,type BusinessFeature} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
type Hit={id:string;kind:string;label:string;code:string;name:string;updatedAt:string};
export function BusinessGlobalSearch({workspace:w,feature}:{workspace:BusinessWorkspace;feature?:BusinessFeature}){
 const root=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState(""),[hits,setHits]=useState<Hit[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(false),[open,setOpen]=useState(false);
 const label=feature?`Tìm trong ${featureLabels[feature]}`:"Tìm mã hoặc tên";
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"&&!document.querySelector('[role="dialog"][aria-modal="true"]')){event.preventDefault();const input=root.current?.querySelector("input");input?.focus();input?.select();}};document.addEventListener("keydown",shortcut);return()=>document.removeEventListener("keydown",shortcut);},[]);
 useEffect(()=>{const q=query.trim();if(q.length<2)return;const controller=new AbortController(),timer=setTimeout(()=>{setLoading(true);setError("");const parameters=new URLSearchParams({q,...(feature?{feature}:{})});fetch(`/api/v1/business/${w.slug}/search?${parameters}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])}).then(async response=>{const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error?.message??"Không tìm được bản ghi.");if(!controller.signal.aborted)setHits(body.data.results);}).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Không tìm được bản ghi.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},250);return()=>{clearTimeout(timer);controller.abort();};},[query,w.slug,feature]);
 return <div ref={root} className={styles.globalSearch} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}} onKeyDown={event=>{
  if(event.key==="Escape"){root.current?.querySelector("input")?.focus();setOpen(false);}
  if(open&&["ArrowDown","ArrowUp","Home","End"].includes(event.key)){
   const links=[...root.current?.querySelectorAll<HTMLAnchorElement>("ul a")??[]];if(!links.length)return;
   const current=links.indexOf(document.activeElement as HTMLAnchorElement);if((event.key==="Home"||event.key==="End")&&current<0)return;
   const next=event.key==="Home"?0:event.key==="End"?links.length-1:event.key==="ArrowUp"?(current<0?links.length-1:(current-1+links.length)%links.length):(current+1)%links.length;
   event.preventDefault();links[next]?.focus();
  }
 }}>
  <label className={styles.visuallyHidden} htmlFor="business-global-search">{label}</label><Search className={styles.searchIcon} size={18} aria-hidden="true"/>
  <input id="business-global-search" type="search" value={query} maxLength={80} placeholder={label} autoComplete="off" aria-controls={open&&query.trim().length>=2?"business-global-search-results":undefined} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setLoading(event.target.value.trim().length>=2);setHits([]);setError("");setOpen(true);}}/>
  <kbd className={styles.searchShortcut} aria-hidden="true">Ctrl K</kbd>
  {open&&query.trim().length>=2?<div id="business-global-search-results" className={styles.globalResults} role="region" aria-label="Kết quả tìm kiếm">{loading?<span role="status">Đang tìm…</span>:error?<span role="alert">{error}</span>:hits.length?<><span className={styles.visuallyHidden} role="status">{hits.length} kết quả</span><ul>{hits.map(hit=><li key={`${hit.kind}:${hit.id}`}><Link href={`/erp/${w.slug}/${hit.kind}?q=${encodeURIComponent(hit.code)}`} onClick={()=>setOpen(false)}><small>{hit.label} · {hit.code}</small><strong>{hit.name}</strong></Link></li>)}</ul></>:<span role="status">Không có kết quả</span>}</div>:null}
 </div>;
}
