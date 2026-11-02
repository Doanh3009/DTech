"use client";
import {useEffect,useState} from "react";
import {PageHeader} from "@/components/shared/PageHeader";
import {Button} from "@/components/shared/Button";
import {BusinessLink as Link} from "./BusinessLink";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
type Notification={id:string;category:string;state:"unread"|"read";createdAt:string;sourceRecordId:string};
type Snapshot={rows:Notification[];total:number;unread:number};
type Meeting={id:string;code:string;name:string;date:string;startsAt:string;endsAt:string;timezone:string;state:string;room:string|null};
type CalendarSnapshot={from:string;to:string;rows:Meeting[]};
const weekdays=["T2","T3","T4","T5","T6","T7","CN"];
function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function calendarRange(anchor:Date,mode:"month"|"week"){
 const start=mode==="month"?new Date(anchor.getFullYear(),anchor.getMonth(),1):new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
 const mondayOffset=(start.getDay()+6)%7;start.setDate(start.getDate()-mondayOffset);
 const length=mode==="month"?42:7;const days=Array.from({length},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
 return {days,from:dayKey(days[0]),to:dayKey(days[days.length-1])};
}
function MeetingCalendar({slug}:{slug:string}){
 const [anchor,setAnchor]=useState(()=>new Date()),[mode,setMode]=useState<"month"|"week">("month"),[data,setData]=useState<CalendarSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const range=calendarRange(anchor,mode);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${slug}/calendar?${new URLSearchParams({from:range.from,to:range.to})}`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không tải được lịch họp.");if(!c.signal.aborted)setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không tải được lịch họp.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[slug,range.from,range.to]);
 const period=mode==="month"?new Intl.DateTimeFormat("vi-VN",{month:"long",year:"numeric"}).format(anchor):`${new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit"}).format(range.days[0])} – ${new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}).format(range.days[6])}`;
 function shift(direction:number){setLoading(true);setError("");setAnchor(d=>new Date(d.getFullYear(),d.getMonth()+(mode==="month"?direction:0),d.getDate()+(mode==="week"?direction*7:0)));}
 const weeks=Array.from({length:range.days.length/7},(_,i)=>range.days.slice(i*7,i*7+7));
 return <section className={styles.workflow}><div className={styles.collaborationHead}><h2>Lịch họp</h2><div className={styles.actions}><Button aria-label="Kỳ trước" disabled={loading} onClick={()=>shift(-1)}>Trước</Button><strong>{period}</strong><Button aria-label="Kỳ sau" disabled={loading} onClick={()=>shift(1)}>Sau</Button><Button variant={mode==="month"?"primary":"secondary"} aria-pressed={mode==="month"} disabled={loading||mode==="month"} onClick={()=>{setLoading(true);setMode("month");}}>Tháng</Button><Button variant={mode==="week"?"primary":"secondary"} aria-pressed={mode==="week"} disabled={loading||mode==="week"} onClick={()=>{setLoading(true);setMode("week");}}>Tuần</Button></div></div>
  {error?<p role="alert">{error}</p>:null}<div className={styles.calendarScroll}><table className={styles.meetingCalendar}><thead><tr>{weekdays.map(d=><th key={d} scope="col">{d}</th>)}</tr></thead><tbody>{weeks.map((week,i)=><tr key={i}>{week.map(date=>{const key=dayKey(date),entries=data?.rows.filter(m=>m.date===key)??[];return <td key={key} className={mode==="month"&&date.getMonth()!==anchor.getMonth()?styles.calendarOutside:undefined}><time dateTime={key}>{date.getDate()}</time><ul>{entries.map(m=><li key={m.id}><Link prefetch={false} href={`/erp/${slug}/meetings?q=${encodeURIComponent(m.code)}`} title={`${m.startsAt.slice(0,5)} · ${m.name}`}>{m.startsAt.slice(0,5)} {m.name}</Link></li>)}</ul></td>;})}</tr>)}</tbody></table></div>
  <span className={styles.user}>{loading?"Đang tải lịch…":`${data?.rows.length??0} cuộc họp`}</span>
 </section>;
}
export function BusinessCollaborationWorkspace({workspace:w}:{workspace:BusinessWorkspace}){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/notifications?page=1`,{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không tải được thông báo.");if(!c.signal.aborted)setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không tải được thông báo.");});return()=>c.abort();},[w.slug,revision]);
 async function markRead(id:string){setBusy(true);setError("");try{const r=await fetch(`/api/v1/business/${w.slug}/notifications/read`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message??"Không thể cập nhật thông báo.");setRevision(n=>n+1);}catch(e){setError(e instanceof Error?e.message:"Không thể cập nhật thông báo.");}finally{setBusy(false);}}
 return <div className={styles.stack}><PageHeader title="Lịch họp & thông báo"/><MeetingCalendar slug={w.slug}/><section className={styles.workflow}><div className={styles.collaborationHead}><h2>Thông báo</h2><span>{data?.unread??0} chưa đọc</span></div>{error?<p role="alert">{error}</p>:null}{!data?.rows.length?<p>Chưa có thông báo</p>:<ul className={styles.notificationList}>{data.rows.map(n=><li key={n.id}><div><strong>Lời mời tham dự cuộc họp</strong><time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString("vi-VN")}</time><Link href={`/erp/${w.slug}/meetings`}>Mở danh sách cuộc họp</Link></div>{n.state==="unread"?<Button disabled={busy} onClick={()=>void markRead(n.id)}>Đánh dấu đã đọc</Button>:<span>Đã đọc</span>}</li>)}</ul>}</section><nav className={styles.quickLinks} aria-label="Nghiệp vụ họp"><Link href={`/erp/${w.slug}/meetings`}>Cuộc họp</Link><Link href={`/erp/${w.slug}/meeting_rooms`}>Phòng họp</Link></nav></div>;
}
