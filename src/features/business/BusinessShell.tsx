"use client";
import { DimixoLogo } from "@/components/shared/DimixoLogo";
import {BusinessLink as Link} from "./BusinessLink";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, UserRound, Menu, X, KeyRound } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { businessEntities, entitiesForFeature, workspaceFeatureFor, featureLabels, type BusinessFeature, type EntityKind } from "./businessCatalog";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";
import {businessCan} from "./businessAccess";
import {BusinessGlobalSearch} from "./BusinessGlobalSearch";
export function BusinessShell({workspace:w,children}:{workspace:BusinessWorkspace;children:ReactNode}){
 const router=useRouter();const pathname=usePathname();const [error,setError]=useState("");const [busy,setBusy]=useState(false);const segments=pathname.split("/");const kind=segments[3] as EntityKind;const feature=(segments[3]==="module"?segments[4]:workspaceFeatureFor(kind,w.features)) as BusinessFeature|undefined;
 const nav=feature?entitiesForFeature(w.industry,w.features,feature).filter(k=>businessCan(w,k,"read")):[];
 const [navPath,setNavPath]=useState<string|null>(null);const [navQuery,setNavQuery]=useState("");const navOpen=navPath===pathname;
 const visibleNav=nav.filter(k=>businessEntities[k].label.toLocaleLowerCase("vi").includes(navQuery.trim().toLocaleLowerCase("vi")));
 async function logout(){setBusy(true);try{const r=await fetch(`/api/v1/business/${w.slug}/logout`,{method:"POST"});if(!r.ok)throw new Error();router.replace(`/erp/${w.slug}/login`);router.refresh();}catch{setError("Chưa thể đăng xuất. Thử lại.");setBusy(false);}}
 return <div className={styles.portal}>
  <a className={styles.skip} href="#business-main">Đến nội dung</a>
  <header className={styles.header}>
   <Link prefetch={false} className={styles.brand} href={`/erp/${w.slug}`} aria-label="Tất cả module"><DimixoLogo compact/><strong>{w.systemName}<span>{w.name}</span></strong></Link>
   <BusinessGlobalSearch workspace={w}/>
   <div className={styles.headerAccount}>{w.isDemo?<span className={styles.user}>Trải nghiệm</span>:null}<DropdownMenu label="Tài khoản" disabled={busy} trigger={<span className={styles.accountTrigger}><UserRound size={18} aria-hidden="true"/><span>{w.displayName}</span></span>}><Link className={styles.accountAction} href={`/erp/${w.slug}/password`}><KeyRound size={16} aria-hidden="true"/>Đổi mật khẩu</Link><Button variant="ghost" onClick={()=>void logout()} busy={busy} leftIcon={<LogOut size={16} aria-hidden="true"/>}>Đăng xuất</Button></DropdownMenu></div>
  </header>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  <div className={feature?styles.body:styles.homeBody}>
   {feature?<aside className={styles.sidebar}>
    <div className={styles.navHeading}><div><Link prefetch={false} className={styles.back} href={`/erp/${w.slug}`}>Tất cả module</Link><strong>{featureLabels[feature]}</strong></div><Button className={styles.navToggle} aria-expanded={navOpen} aria-controls="business-module-navigation" aria-label={navOpen?"Đóng điều hướng nghiệp vụ":"Mở điều hướng nghiệp vụ"} leftIcon={navOpen?<X size={18} aria-hidden="true"/>:<Menu size={18} aria-hidden="true"/>} onClick={()=>setNavPath(navOpen?null:pathname)}>Nghiệp vụ</Button></div>
    <div id="business-module-navigation" className={styles.navigation} data-open={navOpen}>
     {nav.length>6?<Input label="Tìm nghiệp vụ" type="search" value={navQuery} onChange={event=>setNavQuery(event.target.value)} maxLength={80}/>:null}
     <nav aria-label="Nghiệp vụ"><Link prefetch={false} href={`/erp/${w.slug}/module/${feature}`} aria-current={segments[3]==="module"?"page":undefined} onClick={()=>setNavPath(null)}>Điều hành</Link>{visibleNav.map(k=><Link prefetch={false} key={k} href={`/erp/${w.slug}/${k}`} aria-current={kind===k?"page":undefined} onClick={()=>setNavPath(null)}>{businessEntities[k].label}</Link>)}</nav>
     {visibleNav.length===0?<span role="status" className={styles.user}>Không có kết quả</span>:null}
    </div>
   </aside>:null}
   <main id="business-main" className={`page-main ${styles.main}`}>{children}</main>
  </div>
 </div>;
}
