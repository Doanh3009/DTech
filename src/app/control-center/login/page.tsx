import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { can } from "@/lib/auth/permissions";
import styles from "@/features/crm/Crm.module.css";
export const metadata={title:"Team setup · Đăng nhập",robots:{index:false,follow:false}};
export default async function Page(){if(!controlCenterEnabled())notFound();const user=await getRequestUser();if(user&&can(user.permissions,"crm.view"))redirect("/control-center/customers");return <main className={styles.login}><div className={styles.loginCard}><span className={styles.eyebrow}>TEAM SETUP</span><h1>Trung tâm triển khai</h1>{user?<><p role="alert">Tài khoản hiện tại chưa được cấp quyền CRM triển khai.</p><Link className={styles.link} href="/applications">Về không gian làm việc</Link></>:<LoginForm destination="/control-center"/>}<Link className={styles.link} href="/">Trang giới thiệu</Link></div></main>;}
