import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessAuthForm } from "@/features/business/BusinessAuthForm";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { AppError } from "@/lib/api/errors";
import { ErrorState } from "@/components/shared/States";
import styles from "@/features/crm/Crm.module.css";
export const metadata={title:"Đổi mật khẩu ERP",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;let workspace;try{workspace=await readBusinessWorkspace(slug);}catch(e){if(e instanceof AppError&&e.status===401)redirect(`/erp/${slug}/login`);return <main className={styles.login}><ErrorState title={e instanceof AppError?e.message:"Không thể kết nối"}/></main>;}return <main className={styles.login}><div className={styles.loginCard}><span className={styles.eyebrow}>{workspace.name}</span><h1>{workspace.mustChangePassword?"Đặt mật khẩu của bạn":"Đổi mật khẩu"}</h1><BusinessAuthForm slug={slug} changePassword/>{!workspace.mustChangePassword?<Link className={styles.link} href={`/erp/${slug}`}>Về ERP</Link>:null}</div></main>;}
