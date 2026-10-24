import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { MarketingHeader } from "@/features/marketing/MarketingHeader";
import { trialIndustries } from "@/features/marketing/trialSchemas";
import { TrialRequestForm } from "@/features/marketing/TrialRequestForm";
import styles from "@/features/marketing/Marketing.module.css";
import trialStyles from "@/features/marketing/Trial.module.css";

export const metadata:Metadata={title:{absolute:"Đăng ký dùng thử | DIMIXO ERP"},description:"Gửi nhu cầu doanh nghiệp để DIMIXO tư vấn và cấp môi trường dùng thử riêng."};
export default async function Page({searchParams}:{searchParams:Promise<{industry?:string}>}) { if(!controlCenterEnabled())notFound();const selected=(await searchParams).industry;const industry=selected&&Object.hasOwn(trialIndustries,selected)?selected as keyof typeof trialIndustries:"construction"; return <div className={styles.site}><MarketingHeader /><main className={`${styles.container} ${trialStyles.layout}`}><div className={trialStyles.intro}><span className={styles.eyebrow}>BẮT ĐẦU VỚI DIMIXO ERP</span><h1>Một bước nhỏ.<br />Một cách vận hành mới.</h1><p>Chia sẻ bài toán của doanh nghiệp. DIMIXO cùng bạn lựa chọn phạm vi phù hợp trước khi bắt đầu dùng thử.</p><ol className={trialStyles.steps}>{["Gửi nhu cầu của doanh nghiệp","DIMIXO trao đổi & cấu hình môi trường","Nhận tài khoản và bắt đầu dùng thử"].map((stage,index)=><li key={stage}><span>0{index+1}</span>{stage}</li>)}</ol><div className={trialStyles.existing}>Bạn đã được cấp tài khoản?<Link href="/login">Đăng nhập hệ thống</Link></div></div><TrialRequestForm initialIndustry={industry}/></main></div>; }
