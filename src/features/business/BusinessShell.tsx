"use client";
import {useState,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
import {ArrowLeft,ChevronRight,FileText,FolderOpen,KeyRound,LayoutDashboard,ListTree,LogOut,Menu,UserRound,X} from "lucide-react";
import {DimixoLogo} from "@/components/shared/DimixoLogo";
import {Button} from "@/components/shared/Button";
import {Input} from "@/components/shared/FormControls";
import {DropdownMenu} from "@/components/shared/DropdownMenu";
import {BusinessLink as Link} from "./BusinessLink";
import {businessEntities,workspaceFeatureFor,featureLabels,type BusinessFeature,type EntityKind} from "./businessCatalog";
import {businessNavigation} from "./businessPresentation";
import {businessFeatureIcons} from "./businessIcons";
import {BusinessGlobalSearch} from "./BusinessGlobalSearch";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
const groupIcons={documents:FileText,catalogs:FolderOpen,details:ListTree};
export function BusinessShell({workspace:w,children}:{workspace:BusinessWorkspace;children:ReactNode}){
 const router=useRouter(),pathname=usePathname(),segments=pathname.split("/");
 const kind=segments[3] as EntityKind,candidate=(segments[3]==="module"?segments[4]:workspaceFeatureFor(kind,w.features)) as BusinessFeature|undefined;
 const feature=candidate&&Object.hasOwn(featureLabels,candidate)&&w.features.includes(candidate)?candidate:undefined;
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[navPath,setNavPath]=useState<string|null>(null),[search,setSearch]=useState({feature,query:""});
 const query=search.feature===feature?search.query:"",navOpen=navPath===pathname;
 const groups=feature?businessNavigation(w,feature,query):[],allGroups=feature?businessNavigation(w,feature):[];
 const Icon=feature?businessFeatureIcons[feature]:LayoutDashboard;
 async function logout(){setBusy(true);try{const response=await fetch(`/api/v1/business/${w.slug}/logout`,{method:"POST"});if(!response.ok)throw Error();router.replace(`/erp/${w.slug}/login`);router.refresh();}catch{setError("Chưa thể đăng xuất. Thử lại.");setBusy(false);}}
 return <div className={styles.portal}>
  <a className={styles.skip} href="#business-main">Đến nội dung</a>
  <header className={styles.header}>
   <Link className={styles.brand} href={`/erp/${w.slug}`} aria-label="Tất cả module"><DimixoLogo compact/><strong>{w.systemName}<span>{w.name}</span></strong></Link>
   <BusinessGlobalSearch key={`${w.slug}:${feature??"all"}`} workspace={w} feature={feature}/>
   <div className={styles.headerAccount}>{w.isDemo?<span className={styles.demoBadge}>Trải nghiệm</span>:null}<DropdownMenu label="Tài khoản" disabled={busy} trigger={<span className={styles.accountTrigger}><span className={styles.avatar} aria-hidden="true">{w.displayName.trim().slice(0,1).toLocaleUpperCase("vi")||<UserRound size={18}/>}</span><span>{w.displayName}</span></span>}><div className={styles.accountIdentity}><strong>{w.displayName}</strong><span>{w.role==="owner"?"Quản lý":w.role==="editor"?"Người thao tác":"Người xem"}</span></div><Link className={styles.accountAction} href={`/erp/${w.slug}/password`}><KeyRound size={16} aria-hidden="true"/>Đổi mật khẩu</Link><Button variant="ghost" onClick={()=>void logout()} busy={busy} leftIcon={<LogOut size={16} aria-hidden="true"/>}>Đăng xuất</Button></DropdownMenu></div>
  </header>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  <div className={feature?styles.body:styles.homeBody}>
   {feature?<aside className={styles.sidebar}>
    <div className={styles.navHeading}><Link className={styles.back} href={`/erp/${w.slug}`}><ArrowLeft size={16} aria-hidden="true"/>Tất cả module</Link><Button className={styles.navToggle} aria-expanded={navOpen} aria-controls="business-module-navigation" aria-label={navOpen?"Đóng điều hướng nghiệp vụ":"Mở điều hướng nghiệp vụ"} leftIcon={navOpen?<X size={18} aria-hidden="true"/>:<Menu size={18} aria-hidden="true"/>} onClick={()=>setNavPath(navOpen?null:pathname)}>Nghiệp vụ</Button></div>
    <div id="business-module-navigation" className={styles.navigation} data-open={navOpen}>
     {allGroups.reduce((total,group)=>total+group.kinds.length,0)>6?<Input label="Tìm nghiệp vụ" type="search" placeholder="Tên nghiệp vụ" value={query} onChange={event=>setSearch({feature,query:event.target.value})} maxLength={80}/>:null}
     <nav aria-label="Nghiệp vụ"><Link className={styles.navOverview} href={`/erp/${w.slug}/module/${feature}`} aria-current={segments[3]==="module"?"page":undefined} onClick={()=>setNavPath(null)}><LayoutDashboard size={17} aria-hidden="true"/>Điều hành</Link>
      {groups.map(group=>{const GroupIcon=groupIcons[group.key];return <section className={styles.navGroup} key={group.key}><h2>{group.label}<span>{group.kinds.length}</span></h2><div className={styles.navGroupLinks}>{group.kinds.map(candidate=><Link key={candidate} href={`/erp/${w.slug}/${candidate}`} aria-current={kind===candidate?"page":undefined} onClick={()=>setNavPath(null)}><GroupIcon size={16} aria-hidden="true"/><span>{businessEntities[candidate].label}</span></Link>)}</div></section>;})}
     </nav>
     {!groups.length?<span role="status" className={styles.user}>Không có kết quả</span>:null}
    </div>
   </aside>:null}
   <main id="business-main" className={`page-main ${styles.main}`}>
    {feature?<nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href={`/erp/${w.slug}`} aria-label="Tất cả module"><LayoutDashboard size={16} aria-hidden="true"/></Link><ChevronRight size={14} aria-hidden="true"/><Link href={`/erp/${w.slug}/module/${feature}`} aria-current={segments[3]==="module"?"page":undefined}><Icon size={16} aria-hidden="true"/>{featureLabels[feature]}</Link>{segments[3]!=="module"&&businessEntities[kind]?<><ChevronRight size={14} aria-hidden="true"/><span aria-current="page">{businessEntities[kind].label}</span></>:null}</nav>:null}
    {children}
   </main>
  </div>
 </div>;
}
