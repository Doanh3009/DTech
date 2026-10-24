"use client";
import {BusinessLink as Link} from "./BusinessLink";
import { useState } from "react";
import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { can } from "@/lib/auth/permissions";
import { businessIndustries, businessIndustryKeys, featureLabels, type BusinessFeature, type BusinessIndustry } from "./businessCatalog";
import { businessWorkflows } from "./businessWorkflows";
import { IndustryScreenPreview } from "./IndustryScreenPreview";
import styles from "./Business.module.css";

export function BusinessIndustryCatalog(){
 const [selected,setSelected]=useState<BusinessIndustry>("metalworking");const user=useCurrentUser();const workflow=businessWorkflows[selected];
 return <div className={styles.stack}><PageHeader title="Gói ngành & quy trình"/>
  <div className={styles.actions} role="group" aria-label="Gói ngành">{businessIndustryKeys.map(key=><Button key={key} variant={selected===key?"primary":"secondary"} aria-pressed={selected===key} onClick={()=>setSelected(key)}>{businessIndustries[key].label}</Button>)}</div>
  <section className={styles.workflow}><div className={styles.actions}><h2>{workflow.title}</h2>{businessIndustries[selected].features.map(f=><StatusBadge key={f} tone="neutral">{featureLabels[f as BusinessFeature]}</StatusBadge>)}</div></section>
  <section className={styles.workflow} aria-label="Luồng chứng từ"><ol>{workflow.steps.map((step,i)=><li key={step.kind+i}><span>{String(i+1).padStart(2,"0")} · {step.label}</span></li>)}</ol></section>
  <IndustryScreenPreview industry={selected}/>
  {can(user.permissions,"crm.manage")?<div className={styles.actions}><Link className="button button--primary button--md" href={`/control-center/customers/new?industry=${selected}`}>Tạo hồ sơ theo gói ngành</Link></div>:null}
 </div>;
}
