import {BusinessLink as Link} from "./BusinessLink";
import {PageHeader} from "@/components/shared/PageHeader";
import {ArrowUpRight,FileText,FolderOpen,ListTree} from "lucide-react";
import {businessEntities,featureLabels,type BusinessFeature} from "./businessCatalog";
import {businessNavigation} from "./businessPresentation";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
const icons={documents:FileText,catalogs:FolderOpen,details:ListTree};
export function BusinessScopedModule({workspace:w,feature}:{workspace:BusinessWorkspace;feature:BusinessFeature}){return <div className={styles.stack}><PageHeader title={featureLabels[feature]}/>{businessNavigation(w,feature).map(group=>{const Icon=icons[group.key];return <section className={styles.moduleSection} key={group.key}><h2>{group.label}</h2><div className={styles.moduleEntries}>{group.kinds.map(kind=><Link key={kind} href={`/erp/${w.slug}/${kind}`}><Icon size={20} aria-hidden="true"/><strong>{businessEntities[kind].label}</strong><ArrowUpRight size={16} aria-hidden="true"/></Link>)}</div></section>;})}</div>;}
