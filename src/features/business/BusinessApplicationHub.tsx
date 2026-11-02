"use client";
import { useState } from "react";
import { Boxes, Factory, ScanLine, ShieldCheck, ShoppingCart, Contact, HardHat, Settings2, BookOpenCheck, ShoppingBag, Users, Landmark, Calculator, CalendarDays } from "lucide-react";
import { Input } from "@/components/shared/FormControls";
import { EmptyState } from "@/components/shared/States";
import { BusinessLink as Link } from "./BusinessLink";
import { entitiesForFeature, featureLabels } from "./businessCatalog";
import { businessCan } from "./businessAccess";
import type { BusinessWorkspace } from "./businessSchemas";
import styles from "./Business.module.css";

const icons={assets:Landmark,costing:Calculator,accounting:BookOpenCheck,purchasing:ShoppingBag,people:Users,inventory:Boxes,production:Factory,mes:Settings2,traceability:ScanLine,quality:ShieldCheck,sales:ShoppingCart,crm:Contact,projects:HardHat,collaboration:CalendarDays};
export function BusinessApplicationHub({workspace:w}:{workspace:BusinessWorkspace}){
 const [query,setQuery]=useState("");
 const applications=w.features.filter(feature=>entitiesForFeature(w.industry,w.features,feature).some(kind=>businessCan(w,kind,"read")));
 const visible=applications.filter(feature=>featureLabels[feature].toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
 return <section className={styles.stack} aria-label="Ứng dụng doanh nghiệp"><div className={styles.applicationHeader}><h2>Ứng dụng doanh nghiệp</h2><Input label="Tìm ứng dụng" type="search" maxLength={80} value={query} onChange={event=>setQuery(event.target.value)}/></div>{visible.length?<div className={styles.dashboardApps}>{visible.map(feature=>{const Icon=icons[feature];return <Link className={styles.card} data-feature={feature} key={feature} href={`/erp/${w.slug}/module/${feature}`}><span><Icon size={23} aria-hidden="true"/></span><strong>{featureLabels[feature]}</strong></Link>;})}</div>:<EmptyState title="Không tìm thấy ứng dụng"/>}</section>;
}
