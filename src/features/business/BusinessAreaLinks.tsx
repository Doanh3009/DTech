import {ArrowUpRight,ChevronDown,FolderOpen,PanelsTopLeft} from "lucide-react";
import {BusinessLink as Link} from "./BusinessLink";
import {businessWorkAreas,businessWorkAreaHref} from "./businessWorkAreas";
import type {BusinessFeature} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./BusinessWorkArea.module.css";

export function BusinessAreaLinks({workspace:w,feature}:{workspace:BusinessWorkspace;feature:BusinessFeature}){
 const areas=businessWorkAreas(w,feature),primary=areas.filter(area=>!area.secondary),secondary=areas.filter(area=>area.secondary);
 const links=(items:typeof areas)=><div className={styles.launchList}>{items.map(area=><Link key={area.key} href={businessWorkAreaHref(w.slug,feature,area)}><PanelsTopLeft size={20} aria-hidden="true"/><span>{area.label}</span><ArrowUpRight size={17} aria-hidden="true"/></Link>)}</div>;
 return <div className={styles.launch}>{links(primary)}{secondary.length?<details className={styles.setup}><summary><FolderOpen size={17} aria-hidden="true"/>Danh mục & thiết lập<ChevronDown size={17} aria-hidden="true"/></summary>{links(secondary)}</details>:null}</div>;
}
