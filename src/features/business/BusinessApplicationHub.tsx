"use client";
import { useState } from "react";
import { Input } from "@/components/shared/FormControls";
import { EmptyState } from "@/components/shared/States";
import {ErpModuleCard} from "@/components/shared/ErpModuleCard";
import { entitiesForFeature, featureLabels } from "./businessCatalog";
import { businessCan } from "./businessAccess";
import {businessFeatureIcons,businessFeatureAppearance} from "./businessIcons";
import {businessSearchText} from "./businessPresentation";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";

export function BusinessApplicationHub({workspace:w}:{workspace:BusinessWorkspace}){
 const [query,setQuery]=useState("");
 const applications=w.features.filter(feature=>entitiesForFeature(w.industry,w.features,feature).some(kind=>businessCan(w,kind,"read")));
 const visible=applications.filter(feature=>businessSearchText(featureLabels[feature]).includes(businessSearchText(query)));
 return <section className={styles.stack} aria-label="Ứng dụng doanh nghiệp"><div className={styles.applicationHeader}><h2>Ứng dụng doanh nghiệp</h2><Input label="Tìm ứng dụng" type="search" maxLength={80} value={query} onChange={event=>setQuery(event.target.value)}/></div>{visible.length?<div className={styles.dashboardApps}>{visible.map(feature=><ErpModuleCard key={feature} application={{...businessFeatureAppearance[feature],icon:businessFeatureIcons[feature],label:featureLabels[feature],defaultRoute:`/erp/${w.slug}/module/${feature}`}}/>)}</div>:<EmptyState title="Không tìm thấy ứng dụng"/>}</section>;
}
