import {BusinessLink as Link} from "@/features/business/BusinessLink";
import { Boxes, Factory, ScanLine, ShieldCheck, ShoppingCart, Contact, HardHat, Settings2, BookOpenCheck, ShoppingBag, Users, Landmark, Calculator } from "lucide-react";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { businessIndustries, featureLabels,entitiesForFeature } from "@/features/business/businessCatalog";
import {businessCan,businessCanReport} from "@/features/business/businessAccess";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BusinessOverview } from "@/features/business/BusinessOverview";
import styles from "@/features/business/Business.module.css";
const icons={assets:Landmark,costing:Calculator,accounting:BookOpenCheck,purchasing:ShoppingBag,people:Users,inventory:Boxes,production:Factory,mes:Settings2,traceability:ScanLine,quality:ShieldCheck,sales:ShoppingCart,crm:Contact,projects:HardHat};
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const w=await readBusinessWorkspace(slug);if(w.mustChangePassword)return null;
 const apps=<div className={styles.dashboardApps}>{w.features.filter(f=>entitiesForFeature(w.industry,w.features,f).some(k=>businessCan(w,k,"read"))).map(f=>{const Icon=icons[f];return <Link prefetch={false} className={styles.card} key={f} href={`/erp/${slug}/module/${f}`}><span><Icon size={26} aria-hidden="true"/></span><strong>{featureLabels[f]}</strong></Link>;})}</div>;
 return <div className={styles.stack}><PageHeader title={w.name} action={<StatusBadge tone="info">{businessIndustries[w.industry].label}</StatusBadge>}/>{businessCanReport(w)?<BusinessOverview workspace={w} initialMonth={new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit"}).replace("/","-")}>{apps}</BusinessOverview>:apps}{w.role==="owner"?<Link className={styles.link} href={`/erp/${slug}/access`}>Tài khoản & phân quyền</Link>:null}</div>;
}
