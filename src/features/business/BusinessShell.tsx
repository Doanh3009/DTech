"use client";
import { DimixoLogo } from "@/components/shared/DimixoLogo";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import {BusinessLink as Link} from "./BusinessLink";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { businessEntities, entitiesForFeature, workspaceFeatureFor, featureLabels, type BusinessFeature, type EntityKind } from "./businessCatalog";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";
import {businessCan} from "./businessAccess";
export function BusinessShell({workspace:w,children}:{workspace:BusinessWorkspace;children:ReactNode}){
 const router=useRouter();const pathname=usePathname();const [error,setError]=useState("");const [busy,setBusy]=useState(false);const segments=pathname.split("/");const kind=segments[3] as EntityKind;const feature=(segments[3]==="module"?segments[4]:workspaceFeatureFor(kind,w.features)) as BusinessFeature|undefined;
 const nav=feature?entitiesForFeature(w.industry,w.features,feature).filter(k=>businessCan(w,k,"read")):[];
 async function logout(){setBusy(true);try{const r=await fetch(`/api/v1/business/${w.slug}/logout`,{method:"POST"});if(!r.ok)throw new Error();router.replace(`/erp/${w.slug}/login`);router.refresh();}catch{setError("Chưa thể đăng xuất. Thử lại.");setBusy(false);}}
 return <div className={styles.portal}><AmbientBackground/><a className={styles.skip} href="#business-main">Đến nội dung</a><header className={styles.header}><Link prefetch={false} className={styles.brand} href={`/erp/${w.slug}`} aria-label="Tất cả module"><DimixoLogo compact/><strong>{w.systemName}<span>{w.name}</span></strong></Link><div className={styles.actions}>{w.isDemo?<span className={styles.user}>Không gian trải nghiệm</span>:null}<span className={styles.user}>{w.displayName}</span><Link prefetch={false} className={styles.link} href={`/erp/${w.slug}/password`}>Đổi mật khẩu</Link><Button onClick={()=>void logout()} disabled={busy} aria-label="Đăng xuất" leftIcon={<LogOut size={16} aria-hidden="true"/>}>Thoát</Button></div></header>{error?<p role="alert">{error}</p>:null}<div className={feature?styles.body:styles.homeBody}>{feature?<aside className={styles.sidebar}><Link prefetch={false} className={styles.back} href={`/erp/${w.slug}`}>Tất cả module</Link><strong>{featureLabels[feature]}</strong><nav aria-label="Nghiệp vụ"><Link prefetch={false} href={`/erp/${w.slug}/module/${feature}`} aria-current={segments[3]==="module"?"page":undefined}>Điều hành</Link>{nav.map(k=><Link prefetch={false} key={k} href={`/erp/${w.slug}/${k}`} aria-current={kind===k?"page":undefined}>{businessEntities[k].label}</Link>)}</nav></aside>:null}<main id="business-main" className={styles.main}>{children}</main></div></div>;
}
