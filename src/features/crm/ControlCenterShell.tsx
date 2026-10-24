"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ClipboardList, ExternalLink, Layers3, LogOut } from "lucide-react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Button } from "@/components/shared/Button";
import { can } from "@/lib/auth/permissions";
import { useState, type ReactNode } from "react";
import styles from "./Crm.module.css";

export function ControlCenterShell({children}:{children:ReactNode}) {
  const user=useCurrentUser();const {settings}=useSystemSettings();const path=usePathname();const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function logout(){setBusy(true);setError("");try{const r=await fetch("/api/v1/auth/logout",{method:"POST",signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();router.replace("/control-center/login");router.refresh();}catch{setBusy(false);setError("Chưa thể đăng xuất. Vui lòng thử lại.");}}
  return <div className={styles.portal}>
    <a className={styles.skip} href="#control-main">Đến nội dung chính</a>
    <header className={styles.header}><Link className={styles.brand} href="/control-center/customers"><span className={styles.brandIcon}><Building2 size={22} aria-hidden="true"/></span><strong>{settings.organization.shortName}<span>Trung tâm triển khai</span></strong></Link><div className={styles.headerActions}><span className={styles.user}>{user.displayName}</span><Button busy={busy} onClick={()=>void logout()} leftIcon={<LogOut size={16} aria-hidden="true"/>}>Đăng xuất</Button></div></header>
    <div className={styles.body}><aside className={styles.sidebar}><span className={styles.eyebrow}>TEAM SETUP</span><nav aria-label="CRM triển khai"><Link aria-current={path.startsWith("/control-center/customers")?"page":undefined} href="/control-center/customers"><Building2 size={18} aria-hidden="true"/>Khách hàng & triển khai</Link>{can(user.permissions,"trial_request.view")?<Link aria-current={path==="/control-center/trials"?"page":undefined} href="/control-center/trials"><ClipboardList size={18} aria-hidden="true"/>Đăng ký dùng thử</Link>:null}<Link aria-current={path==="/control-center/industries"?"page":undefined} href="/control-center/industries"><Layers3 size={18} aria-hidden="true"/>Gói ngành & quy trình</Link></nav><Link className={styles.website} href="/" target="_blank" rel="noopener noreferrer">Trang giới thiệu<ExternalLink size={15} aria-hidden="true"/></Link></aside><main className={styles.main} id="control-main">{error?<div role="alert" className="form-alert form-alert--error">{error}</div>:null}{children}</main></div>
  </div>;
}
