"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Modal } from "@/components/shared/Overlays";
import { businessIndustries, businessIndustryKeys, featureLabels, type BusinessIndustry, type BusinessFeature } from "@/features/business/businessCatalog";
import { businessWorkflows } from "@/features/business/businessWorkflows";
import { IndustryScreenPreview } from "@/features/business/IndustryScreenPreview";
import { marketingConfig } from "@/config/marketing";
import styles from "./Showcase.module.css";

export function IndustryCases() {
 const [selected,setSelected]=useState<BusinessIndustry>("metalworking");const [expanded,setExpanded]=useState(false);
 const workspaceRef=useRef<HTMLDivElement>(null);
 const scenario=businessWorkflows[selected];
 return <section id="thuc-te" className={styles.casesSection} aria-labelledby="industry-case-title">
  <div className={styles.sectionHeading}><div><span className={styles.kicker}>03 / BÀI TOÁN THEO NGÀNH</span><h2 id="industry-case-title">Cách vận hành khác nhau.<br/><span>Một tư duy kết nối.</span></h2></div><span className={styles.sampleBadge}>06 ngành · 06 mẫu giao diện</span></div>
  <div ref={workspaceRef} className={styles.caseWorkspace}>
  <div role="group" aria-label="Chọn tình huống theo ngành" className={styles.industryTabs}>{businessIndustryKeys.map(key=><button key={key} type="button" aria-pressed={selected===key} onClick={()=>{setSelected(key);workspaceRef.current?.scrollIntoView({block:"start",behavior:"instant"});}}>{businessIndustries[key].label}</button>)}</div>
  <article className={styles.caseCard}>
   <div className={styles.caseVisual}><IndustryScreenPreview industry={selected} dimensional/></div>
   <div className={styles.caseCopy}><span className={styles.kicker}>{businessIndustries[selected].solution}</span><h3>{scenario.headline}</h3><p>{scenario.scenario}</p>
    <div className={styles.previewSource}>Giao diện dashboard dùng chung với ERP · Số liệu mẫu</div>
    <div className={styles.caseActions}><button className={styles.previewButton} type="button" onClick={()=>setExpanded(true)}>Xem mẫu giao diện<ArrowUpRight size={16} aria-hidden="true"/></button><Link href={`${marketingConfig.trialHref}?industry=${selected}`}>Đăng ký ngành này<ArrowRight size={15} aria-hidden="true"/></Link></div>
    <details className={styles.caseDetails} key={selected}><summary>Quy trình & module<ArrowRight size={15} aria-hidden="true"/></summary><ol className={styles.caseFlow}>{scenario.steps.map((step,i)=><li key={step.kind+i}><span>{step.label}</span>{i<scenario.steps.length-1?<ArrowRight size={14} aria-hidden="true"/>:null}</li>)}</ol><ul>{businessIndustries[selected].features.map(f=><li key={f}><Check size={16} aria-hidden="true"/>{featureLabels[f as BusinessFeature]}</li>)}</ul></details>
   </div>
  </article>
  </div>
  <Modal open={expanded} title={`Mẫu giao diện · ${businessIndustries[selected].label}`} onClose={()=>setExpanded(false)} className={styles.industryModal}><IndustryScreenPreview industry={selected}/></Modal>
 </section>;
}
