import {BusinessLink as Link} from "@/features/business/BusinessLink";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { businessIndustries } from "@/features/business/businessCatalog";
import {businessCanReport} from "@/features/business/businessAccess";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BusinessOverview } from "@/features/business/BusinessOverview";
import { BusinessApprovalInbox } from "@/features/business/BusinessApprovalInbox";
import { BusinessApplicationHub } from "@/features/business/BusinessApplicationHub";
import styles from "@/features/business/Business.module.css";
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const w=await readBusinessWorkspace(slug);if(w.mustChangePassword)return null;
 return <div className={styles.stack}><PageHeader title={w.name} action={<StatusBadge tone="info">{businessIndustries[w.industry].label}</StatusBadge>}/><BusinessApplicationHub workspace={w}/>{businessCanReport(w)?<BusinessOverview workspace={w} initialMonth={new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit"}).format(new Date())}/>:null}{w.role!=="viewer"?<BusinessApprovalInbox workspace={w}/>:null}{w.role==="owner"?<Link className={styles.link} href={`/erp/${slug}/access`}>Tài khoản & phân quyền</Link>:null}</div>;
}
