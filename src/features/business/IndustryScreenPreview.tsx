import { Grid2X2 } from "lucide-react";
import snapshots from "@/config/businessDashboardPreviews.json";
import { businessIndustries, type BusinessIndustry } from "./businessCatalog";
import { CompanyDashboard } from "./CompanyDashboard";
import type { CompanyDashboardSnapshot } from "./businessDashboardData";
import styles from "./IndustryScreenPreview.module.css";

/** Public, synthetic snapshots exported from the local demo database. No tenant API access. */
export function IndustryScreenPreview({industry,dimensional=false}:{industry:BusinessIndustry;dimensional?:boolean}){
 const data=snapshots[industry] as CompanyDashboardSnapshot;
 return <figure className={styles.preview} data-dimensional={dimensional}>
  <figcaption>Dashboard ERP · {businessIndustries[industry].label}</figcaption>
  <div className={styles.stage}><div className={styles.backplate} aria-hidden="true"/><div className={styles.screen}>
   <div className={styles.windowBar}><span className={styles.dots} aria-hidden="true"><i/><i/><i/></span><strong>DIMIXO ERP</strong><span>Tổng quan doanh nghiệp</span><small>Dữ liệu mẫu · 10/2026</small></div>
   <div className={styles.shell}><div className={styles.rail} aria-hidden="true"><Grid2X2 size={18}/>{[0,1,2,3].map(n=><i key={n}/>)}</div><div className={styles.content}><CompanyDashboard data={data} industry={industry} compact={dimensional}/></div></div>
  </div></div>
  {!dimensional?<p className={styles.note}>Cùng component với dashboard trong ERP. Số liệu trải nghiệm công khai; không kết nối dữ liệu khách hàng.</p>:null}
 </figure>;
}
