"use client";
import{useCallback,useEffect,useRef,useState,type FormEvent}from"react";
import{Button}from"@/components/shared/Button";
import{Input}from"@/components/shared/FormControls";
import{DataTable}from"@/components/shared/DataTable";
import{StatusBadge}from"@/components/shared/StatusBadge";
import{BusinessReference}from"./BusinessReference";
import styles from"./Business.module.css";

interface Line{id:string;code:string;name:string;account:string;accountName:string;debit:number;credit:number;partner:string|null;project:string|null}
interface Props{slug:string;journalId:string;editable:boolean;disabled?:boolean;onUpdated:(version:number,reviewedBy:string|null,origin?:"read"|"write")=>void;onBusyChange:(busy:boolean)=>void;onPendingChange:(pending:boolean)=>void}
export function BusinessJournalPanel({slug,journalId,editable,disabled=false,onUpdated,onBusyChange,onPendingChange}:Props){
 const[lines,setLines]=useState<Line[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const[account,setAccount]=useState<string|null>(null),[debit,setDebit]=useState(0),[credit,setCredit]=useState(0),[name,setName]=useState(""),[touched,setTouched]=useState(false),[pending,setPending]=useState<Record<string,unknown>|null>(null);
 const callback=useRef(onUpdated),signals=useRef({onBusyChange,onPendingChange}),running=useRef(false),mounted=useRef(true),sequence=useRef(0);
 useEffect(()=>{callback.current=onUpdated;signals.current={onBusyChange,onPendingChange};},[onUpdated,onBusyChange,onPendingChange]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;signals.current.onPendingChange(false);signals.current.onBusyChange(false);};},[]);
 useEffect(()=>{signals.current.onPendingChange(touched||!!pending||busy);},[touched,pending,busy]);
 const load=useCallback(async(signal?:AbortSignal,origin:"read"|"write"="read")=>{
  const current=++sequence.current;
  try{
   const response=await fetch(`/api/v1/business/${slug}/journals/${journalId}`,{cache:"no-store",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}),body=await response.json();
   if(!response.ok||!body.ok||!Array.isArray(body.data?.lines)||!Number.isInteger(body.data.rowVersion))throw Error(body.error?.message??"Chưa tải được định khoản.");
   if(!signal?.aborted&&mounted.current&&sequence.current===current){setLines(body.data.lines);callback.current(body.data.rowVersion,body.data.reviewedBy,origin);}
  }catch(cause){if(!signal?.aborted&&mounted.current&&sequence.current===current)setError(cause instanceof Error?cause.message:"Chưa tải được định khoản.");}
  finally{if(!signal?.aborted&&mounted.current&&sequence.current===current)setLoading(false);}
 },[slug,journalId]);
 useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)void load(controller.signal);});return()=>controller.abort();},[load]);
 function change(action:()=>void){action();setTouched(true);setError("");signals.current.onPendingChange(true);}
 function discard(){if(busy||pending||disabled)return;if(touched&&!window.confirm("Bỏ dòng định khoản đang nhập?"))return;setName("");setAccount(null);setDebit(0);setCredit(0);setTouched(false);setError("");}
 async function add(event?:FormEvent){
  event?.preventDefault();if(running.current||disabled||!editable)return;
  if(!pending&&(!account||name.trim().length<2||![debit,credit].every(value=>Number.isFinite(value)&&value>=0&&value<=1e15)||!((debit>0&&credit===0)||(credit>0&&debit===0)))){setError("Chọn tài khoản, nhập diễn giải và một bên Nợ hoặc Có.");return;}
  const body=pending??{requestId:crypto.randomUUID(),recordId:crypto.randomUUID(),rowVersion:0,data:{code:`DK-${Date.now()}-${crypto.randomUUID().slice(0,6)}`,name:name.trim(),notes:"",journal_id:journalId,account_id:account,debit,credit,partner_id:null,project_id:null}};
  running.current=true;setBusy(true);signals.current.onBusyChange(true);signals.current.onPendingChange(true);setError("");setPending(body);
  try{
   const response=await fetch(`/api/v1/business/${slug}/records/journal_lines`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)}),result=await response.json();
   if(!response.ok||!result.ok){if(response.status<500&&response.status!==429)setPending(null);throw Error(result.error?.message??"Chưa xác nhận được dòng định khoản.");}
   if(result.data?.recordId!==body.recordId||!Number.isInteger(result.data?.rowVersion)||result.data.rowVersion<1)throw Error("Chưa xác nhận được dòng định khoản. Thử lại cùng yêu cầu.");
   if(!mounted.current)return;setPending(null);setName("");setDebit(0);setCredit(0);setTouched(false);setLoading(true);await load(undefined,"write");
  }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Chưa xác nhận được dòng định khoản.");}
  finally{running.current=false;if(mounted.current){setBusy(false);signals.current.onBusyChange(false);}}
 }
 const number=(value:number)=>value.toLocaleString("vi-VN"),dr=lines.reduce((sum,line)=>sum+Number(line.debit),0),cr=lines.reduce((sum,line)=>sum+Number(line.credit),0),locked=disabled||busy||!!pending;
 return <section className={styles.stack} aria-label="Định khoản"><div className={styles.actions}><h2>Định khoản</h2><StatusBadge tone={dr>0&&dr===cr?"success":"warning"}>Nợ {number(dr)} · Có {number(cr)}</StatusBadge></div>
  <DataTable<Line> className={styles.operationalTable} data={lines} loading={loading} error={error} emptyTitle="Chưa có dòng định khoản" getRowId={line=>line.id} columns={[{id:"account",header:"Tài khoản",accessor:"account",priority:"primary"},{id:"accountName",header:"Tên tài khoản",accessor:"accountName"},{id:"name",header:"Diễn giải",accessor:"name"},{id:"debit",header:"Nợ",cell:line=>number(Number(line.debit))},{id:"credit",header:"Có",cell:line=>number(Number(line.credit))}]}/>
  {editable?<form className={styles.fields} aria-label="Nhập dòng định khoản" onSubmit={event=>void add(event)} noValidate><BusinessReference slug={slug} kind="gl_accounts" label="Tài khoản" required value={account} disabled={locked} onChange={value=>change(()=>setAccount(value))}/><Input label="Diễn giải" value={name} maxLength={180} disabled={locked} onChange={event=>change(()=>setName(event.target.value))}/><Input type="number" label="Phát sinh Nợ" min={0} max={1e15} step="0.0001" value={debit} disabled={locked} onChange={event=>change(()=>setDebit(Number(event.target.value)))}/><Input type="number" label="Phát sinh Có" min={0} max={1e15} step="0.0001" value={credit} disabled={locked} onChange={event=>change(()=>setCredit(Number(event.target.value)))}/><div className={styles.actions}><Button type="submit" disabled={busy||loading||disabled} busy={busy}>{pending?"Thử lại cùng yêu cầu":"Thêm định khoản"}</Button>{touched&&!pending?<Button disabled={busy||disabled} onClick={discard}>Bỏ dòng đang nhập</Button>:null}</div></form>:null}
 </section>;
}
