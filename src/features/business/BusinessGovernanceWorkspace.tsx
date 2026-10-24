"use client";

import {useEffect,useState} from "react";
import {Button} from "@/components/shared/Button";
import {DataTable} from "@/components/shared/DataTable";
import {Input,Select} from "@/components/shared/FormControls";
import {Drawer} from "@/components/shared/Overlays";
import {PageHeader} from "@/components/shared/PageHeader";
import {StatusBadge} from "@/components/shared/StatusBadge";
import {BusinessAccessWorkspace} from "./BusinessAccessWorkspace";
import {BusinessReference} from "./BusinessReference";
import {businessEntities,type EntityKind} from "./businessCatalog";
import {businessMemberCommand,type BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";

interface Member{id:string;username:string;display_name:string;role:"owner"|"editor"|"viewer";status:string;management_version:number;staff_id:string|null;staff_name:string|null;access_expires_at:string|null;last_seen_at:string|null;must_change_password:boolean}
interface Audit{id:string;created_at:string;actor:string;action:string;entity_kind:string|null;entity_id:string|null;details:Record<string,unknown>}
type Command=ReturnType<typeof businessMemberCommand.parse>;
const datetime=(v:string|null)=>v?new Date(v).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"—";
const roles={owner:"Chủ doanh nghiệp",editor:"Nhân viên",viewer:"Chỉ xem"};

export function BusinessGovernanceWorkspace({workspace:w}:{workspace:BusinessWorkspace}){
 const [tab,setTab]=useState("members"),[visited,setVisited]=useState(["members"]);
 return <div className={styles.stack}>
  <nav className={styles.actions} aria-label="Quản trị doanh nghiệp">{[["members","Tài khoản"],["access","Phân quyền"],["audit","Nhật ký"]].map(([key,label])=><Button key={key} variant={tab===key?"primary":"secondary"} aria-pressed={tab===key} onClick={()=>{setTab(key);setVisited(v=>[...new Set([...v,key])]);}}>{label}</Button>)}</nav>
  {visited.includes("members")?<section hidden={tab!=="members"}><BusinessMembers workspace={w}/></section>:null}
  {visited.includes("access")?<section hidden={tab!=="access"}><BusinessAccessWorkspace workspace={w}/></section>:null}
  {visited.includes("audit")?<section hidden={tab!=="audit"}><BusinessAudit workspace={w}/></section>:null}
 </div>;
}

function BusinessMembers({workspace:w}:{workspace:BusinessWorkspace}){
 const [data,setData]=useState<{rows:Member[];total:number}|null>(null),[page,setPage]=useState(1),[q,setQ]=useState(""),[query,setQuery]=useState(""),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [draft,setDraft]=useState<Command|null>(null),[pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),[secret,setSecret]=useState("");
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/members?${new URLSearchParams({page:String(page),q:query})}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message);if(!c.signal.aborted)setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chưa tải được tài khoản.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,page,query,revision]);
 useEffect(()=>{if(!draft)return;const warn=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[draft]);
 function open(m:Member|null,operation:Command["operation"]="create"){
  setError("");setSecret("");setPending(null);
  setDraft({requestId:crypto.randomUUID(),accountId:m?.id??crypto.randomUUID(),rowVersion:m?.management_version??0,operation,reason:"",username:m?.username??"",displayName:m?.display_name??"",role:m?.role==="viewer"?"viewer":"editor",staffId:m?.staff_id??null,expiresAt:m?.access_expires_at??null});
 }
 async function save(){
  const parsed=businessMemberCommand.safeParse(pending??draft);if(!parsed.success){setError("Nhập đủ tài khoản, nhân viên và lý do tối thiểu 3 ký tự.");return;}
  setBusy(true);setPending(parsed.data);setError("");
  try{const r=await fetch(`/api/v1/business/${w.slug}/members`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(parsed.data),signal:AbortSignal.timeout(20000)});const b=await r.json();if(!r.ok||!b.ok){if(r.status<500&&r.status!==429)setPending(null);throw Error(b.error?.message);}setSecret(b.data.initialPassword??"");setPending(null);setDraft(null);setLoading(true);setError("");setRevision(v=>v+1);}catch(e){setError(e instanceof Error?e.message:"Chưa xác nhận được thay đổi.");}finally{setBusy(false);}
 }
 const edit=draft&&(draft.operation==="create"||draft.operation==="update");
 return <div className={styles.stack}>
  <PageHeader title="Tài khoản doanh nghiệp" action={<Button variant="primary" onClick={()=>open(null)}>Cấp tài khoản</Button>}/>
  {error?<div className="form-alert form-alert--error" role="alert">{error}</div>:null}
  {secret?<section className={styles.readOnly} aria-label="Mật khẩu vừa cấp"><strong>Mật khẩu ban đầu</strong><Input label="Mật khẩu" value={secret} readOnly autoComplete="off"/><div className={styles.actions}><Button onClick={()=>void navigator.clipboard.writeText(secret).catch(()=>setError("Chưa sao chép được. Chọn và sao chép mật khẩu trong ô."))}>Sao chép</Button><Button onClick={()=>setSecret("")}>Đóng</Button></div></section>:null}
  <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setQuery(q);setPage(1);setLoading(true);setError("");setRevision(v=>v+1);}}><Input label="Tìm tài khoản" value={q} maxLength={100} onChange={e=>setQ(e.target.value)}/><Button type="submit">Tìm</Button></form>
  <DataTable<Member> data={data?.rows??[]} loading={loading} error={error} getRowId={m=>m.id} emptyTitle="Chưa có tài khoản" columns={[
   {id:"display_name",header:"Họ tên",priority:"primary",accessor:"display_name"},{id:"username",header:"Tài khoản",accessor:"username"},{id:"staff_name",header:"Hồ sơ nhân viên",cell:m=>m.staff_name??"—"},{id:"role",header:"Vai trò",cell:m=>roles[m.role]},
   {id:"status",header:"Trạng thái",cell:m=><StatusBadge tone={m.status==="active"?"success":"neutral"}>{m.status==="active"?m.access_expires_at&&Date.parse(m.access_expires_at)<=Date.now()?"Hết hạn":"Đang hoạt động":"Tạm khóa"}</StatusBadge>},
   {id:"access_expires_at",header:"Hạn truy cập",cell:m=>datetime(m.access_expires_at)},{id:"last_seen_at",header:"Hoạt động gần nhất",cell:m=>datetime(m.last_seen_at)}
  ]} actions={m=>m.role!=="owner"?<div className={styles.actions}><Button onClick={()=>open(m,"update")}>Sửa</Button><Button onClick={()=>open(m,"reset")}>Cấp lại mật khẩu</Button><Button onClick={()=>open(m,m.status==="active"?"disable":"enable")}>{m.status==="active"?"Khóa":"Mở khóa"}</Button></div>:null}/>
  <div className={styles.pagination}><span>{data?.total??0} tài khoản · Trang {page}</span><div className={styles.actions}><Button disabled={loading||page===1} onClick={()=>{setLoading(true);setError("");setPage(v=>v-1);}}>Trước</Button><Button disabled={loading||page*25>=(data?.total??0)} onClick={()=>{setLoading(true);setError("");setPage(v=>v+1);}}>Sau</Button></div></div>
  <Drawer open={!!draft} title={draft?({create:"Cấp tài khoản",update:"Cập nhật tài khoản",reset:"Cấp lại mật khẩu",disable:"Khóa tài khoản",enable:"Mở khóa tài khoản"})[draft.operation]:"Tài khoản"} onClose={()=>{if(busy||pending)return;if(window.confirm("Đóng thay đổi chưa lưu?"))setDraft(null);}}>
   {draft?<form className={styles.stack} onSubmit={e=>{e.preventDefault();void save();}}>
    <fieldset disabled={busy||!!pending} className={styles.fields}>
     {edit?<><Input label="Tên đăng nhập" required value={draft.username??""} readOnly={draft.operation==="update"} onChange={e=>setDraft({...draft,username:e.target.value})}/><Input label="Họ tên" required maxLength={100} value={draft.displayName??""} onChange={e=>setDraft({...draft,displayName:e.target.value})}/><Select label="Vai trò" value={draft.role??"editor"} options={[{value:"editor",label:roles.editor},{value:"viewer",label:roles.viewer}]} onChange={e=>setDraft({...draft,role:e.target.value as "editor"|"viewer"})}/>{w.features.includes("people")?<BusinessReference slug={w.slug} kind="staff" disabled={busy||!!pending} label="Hồ sơ nhân viên" value={draft.staffId??null} onChange={id=>setDraft({...draft,staffId:id})}/>:null}<Input label="Hạn truy cập · giờ Việt Nam" type="datetime-local" value={draft.expiresAt?new Date(Date.parse(draft.expiresAt)+7*3600000).toISOString().slice(0,16):""} onChange={e=>setDraft({...draft,expiresAt:e.target.value?new Date(e.target.value+":00+07:00").toISOString():null})}/></>:<strong>{draft.displayName}</strong>}
     <Input label="Lý do" required minLength={3} maxLength={500} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/>
    </fieldset>
    {error?<div className="form-alert form-alert--error" role="alert">{error}</div>:null}
    <Button variant="primary" type="submit" busy={busy}>{pending?"Thử lại cùng yêu cầu":"Lưu thay đổi"}</Button>
   </form>:null}
  </Drawer>
 </div>;
}

const auditLabels:Record<string,string>={"access.updated":"Thay đổi quyền","access.validity_changed":"Thời hạn quyền","member.create":"Cấp tài khoản","member.update":"Cập nhật tài khoản","member.reset":"Cấp lại mật khẩu","member.disable":"Khóa tài khoản","member.enable":"Mở khóa tài khoản","password.changed":"Đổi mật khẩu"};
function BusinessAudit({workspace:w}:{workspace:BusinessWorkspace}){
 const [page,setPage]=useState(1),[q,setQ]=useState(""),[query,setQuery]=useState(""),[revision,setRevision]=useState(0),[data,setData]=useState<{rows:Audit[];total:number}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[selected,setSelected]=useState<Audit|null>(null);
 useEffect(()=>{const c=new AbortController();fetch(`/api/v1/business/${w.slug}/audit?${new URLSearchParams({page:String(page),q:query})}`,{cache:"no-store",signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error?.message);if(!c.signal.aborted)setData(b.data);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chưa tải được nhật ký.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[w.slug,page,query,revision]);
 return <div className={styles.stack}><PageHeader title="Nhật ký doanh nghiệp"/><form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setQuery(q);setPage(1);setLoading(true);setError("");setRevision(v=>v+1);}}><Input label="Tìm thao tác / mã chứng từ" value={q} maxLength={100} onChange={e=>setQ(e.target.value)}/><Button type="submit">Tìm</Button></form>
  <DataTable<Audit> data={data?.rows??[]} loading={loading} error={error} getRowId={r=>r.id} emptyTitle="Chưa có lịch sử" columns={[{id:"created_at",header:"Thời điểm",priority:"primary",cell:r=>datetime(r.created_at)},{id:"actor",header:"Người thao tác",accessor:"actor"},{id:"action",header:"Thao tác",cell:r=>auditLabels[r.action]??r.action},{id:"entity_kind",header:"Nghiệp vụ",cell:r=>r.entity_kind&&businessEntities[r.entity_kind as EntityKind]?.label||r.entity_kind==="accounts"&&"Tài khoản"||"—"}]} actions={r=><Button onClick={()=>setSelected(r)}>Chi tiết</Button>}/>
  <div className={styles.pagination}><span>{data?.total??0} thao tác · Trang {page}</span><div className={styles.actions}><Button disabled={loading||page===1} onClick={()=>{setLoading(true);setError("");setPage(v=>v-1);}}>Trước</Button><Button disabled={loading||page*25>=(data?.total??0)} onClick={()=>{setLoading(true);setError("");setPage(v=>v+1);}}>Sau</Button></div></div>
  <Drawer open={!!selected} title="Chi tiết nhật ký" onClose={()=>setSelected(null)}>{selected?<div className={styles.stack}><strong>{selected.actor} · {datetime(selected.created_at)}</strong><span>{auditLabels[selected.action]??selected.action}</span><pre className={styles.auditDetail}>{JSON.stringify(selected.details,null,2)}</pre></div>:null}</Drawer>
 </div>;
}
