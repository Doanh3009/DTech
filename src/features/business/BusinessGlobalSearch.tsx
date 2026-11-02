"use client";
import {useEffect,useRef,useState} from "react";
import {BusinessLink as Link} from "./BusinessLink";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
type Hit={id:string;kind:string;label:string;code:string;name:string;updatedAt:string};
export function BusinessGlobalSearch({workspace:w}:{workspace:BusinessWorkspace}){
 const root=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState(""),[hits,setHits]=useState<Hit[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(false),[open,setOpen]=useState(false);
 useEffect(()=>{const q=query.trim();if(q.length<2)return;const c=new AbortController();const timer=setTimeout(()=>{setLoading(true);setError("");fetch(`/api/v1/business/${w.slug}/search?q=${encodeURIComponent(q)}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(12000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không tìm được bản ghi.");if(!c.signal.aborted)setHits(b.data.results);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không tìm được bản ghi.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},250);return()=>{clearTimeout(timer);c.abort();};},[query,w.slug]);
 return <div ref={root} className={styles.globalSearch} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}} onKeyDown={event=>{if(event.key==="Escape"){root.current?.querySelector("input")?.focus();setOpen(false);}if(event.key==="ArrowDown"&&open){const first=root.current?.querySelector<HTMLAnchorElement>("ul a");if(first){event.preventDefault();first.focus();}}}}>
  <label className={styles.visuallyHidden} htmlFor="business-global-search">Tìm mã hoặc tên</label>
  <input id="business-global-search" type="search" value={query} maxLength={80} placeholder="Tìm mã hoặc tên" autoComplete="off" aria-controls={open&&query.trim().length>=2?"business-global-search-results":undefined} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setLoading(event.target.value.trim().length>=2);setHits([]);setError("");setOpen(true);}}/>
  {open&&query.trim().length>=2?<div id="business-global-search-results" className={styles.globalResults} role="region" aria-label="Kết quả tìm kiếm">{loading?<span role="status">Đang tìm…</span>:error?<span role="alert">{error}</span>:hits.length?<><span className={styles.visuallyHidden} role="status">{hits.length} kết quả</span><ul>{hits.map(hit=><li key={`${hit.kind}:${hit.id}`}><Link href={`/erp/${w.slug}/${hit.kind}?q=${encodeURIComponent(hit.code)}`} onClick={()=>setOpen(false)}><small>{hit.label} · {hit.code}</small><strong>{hit.name}</strong></Link></li>)}</ul></>:<span role="status">Không có kết quả</span>}</div>:null}
 </div>;
}
