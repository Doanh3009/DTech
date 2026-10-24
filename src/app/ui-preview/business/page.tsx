import { notFound } from "next/navigation";
import { businessIndustries, businessIndustryKeys, featureKeys, featureLabels, type BusinessFeature, type BusinessIndustry } from "@/features/business/businessCatalog";
import { businessKind } from "@/features/business/businessSchemas";
import { BusinessModuleWorkspace } from "@/features/business/BusinessModuleWorkspace";
import { BusinessRecords } from "@/features/business/BusinessRecords";
import { BusinessShell } from "@/features/business/BusinessShell";
import { PageHeader } from "@/components/shared/PageHeader";
import type { BusinessWorkspace } from "@/features/business/businessSchemas";
import styles from "@/features/business/Business.module.css";
export default async function Page({searchParams}:{searchParams:Promise<{industry?:string;kind?:string;feature?:string}>}){
 if(process.env.NODE_ENV==="production")notFound();const p=await searchParams;const industry=(p.industry??"construction") as BusinessIndustry;if(!businessIndustryKeys.includes(industry))notFound();
 const w:BusinessWorkspace={tenantId:"10000000-0000-4000-8000-000000000090",slug:"synthetic-preview",name:"Doanh nghiệp mẫu",systemName:"ERP · Mẫu phát triển",industry,features:businessIndustries[industry].features as BusinessWorkspace["features"],status:"trial",trialEndsAt:"2099-12-31",accountId:"10000000-0000-4000-8000-000000000091",username:"preview",displayName:"Tài khoản mẫu",role:"owner",mustChangePassword:false};
 const kind=p.kind?businessKind.safeParse(p.kind):null;if(kind&&!kind.success)notFound();
 return <BusinessShell workspace={w}><div className={styles.stack}><span>Dữ liệu xem trước · không cấp phiên đăng nhập</span>{p.feature&&featureKeys.includes(p.feature as BusinessFeature)&&w.features.includes(p.feature as BusinessFeature)?<BusinessModuleWorkspace workspace={w} feature={p.feature as BusinessFeature}/>:kind?.success?<BusinessRecords workspace={w} kind={kind.data}/>:<><PageHeader title="Module mẫu"/><div className={styles.cards}>{w.features.map(f=><div className={styles.card} key={f}><strong>{featureLabels[f]}</strong></div>)}</div></>}</div></BusinessShell>;
}
