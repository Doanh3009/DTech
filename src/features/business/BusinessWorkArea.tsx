import type {ReactNode} from "react";
import {ChevronDown,LayoutDashboard,ListTree} from "lucide-react";
import {BusinessLink as Link} from "./BusinessLink";
import {businessEntities,type BusinessFeature,type EntityKind} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import {businessAreaForKind,businessWorkAreaHref,type BusinessWorkArea as WorkArea} from "./businessWorkAreas";
import styles from "./BusinessWorkArea.module.css";

export function BusinessWorkArea({workspace:w,feature,area:provided,activeKind,children}:{workspace:BusinessWorkspace;feature:BusinessFeature;area?:WorkArea;activeKind:EntityKind;children:ReactNode}){
 const area=provided??businessAreaForKind(w,feature,activeKind);
 if(!area)return children;
 const detailActive=area.contextualKinds.includes(activeKind);
 return <div className={styles.area} data-ui="business-work-area" data-work-area={area.key} data-active-kind={activeKind}>
  <header className={styles.header}>
   <div className={styles.heading}><strong className={styles.areaName}>{area.label}</strong><Link className={styles.overview} href={`/erp/${w.slug}/module/${feature}`}><LayoutDashboard size={16} aria-hidden="true"/>Tổng quan</Link></div>
   <nav className={styles.tabs} data-ui="business-work-area-tabs" aria-label={`Quy trình ${area.label}`}><div>{area.kinds.map(kind=><Link key={kind} href={businessWorkAreaHref(w.slug,feature,area,kind)} aria-current={kind===activeKind?"page":undefined}>{businessEntities[kind].label}</Link>)}</div></nav>
   {area.contextualKinds.length?<details key={`${area.key}:${detailActive}`} className={styles.context} open={detailActive}><summary><ListTree size={16} aria-hidden="true"/>Chi tiết chứng từ<ChevronDown size={16} aria-hidden="true"/></summary><div className={styles.contextLinks}>{area.contextualKinds.map(kind=><Link key={kind} href={businessWorkAreaHref(w.slug,feature,area,kind)} aria-current={kind===activeKind?"page":undefined}>{businessEntities[kind].label}</Link>)}</div></details>:null}
  </header>
  <div className={styles.content}>{children}</div>
 </div>;
}
