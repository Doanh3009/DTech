import {BusinessLink as Link} from "./BusinessLink";
import {PageHeader} from "@/components/shared/PageHeader";
import {businessEntities,entitiesForFeature,featureLabels,type BusinessFeature} from "./businessCatalog";
import {businessCan} from "./businessAccess";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
export function BusinessScopedModule({workspace:w,feature}:{workspace:BusinessWorkspace;feature:BusinessFeature}){return <div className={styles.stack}><PageHeader title={featureLabels[feature]}/><div className={styles.actions}>{entitiesForFeature(w.industry,w.features,feature).filter(k=>businessCan(w,k,"read")).map(k=><Link prefetch={false} className={styles.link} key={k} href={`/erp/${w.slug}/${k}`}>{businessEntities[k].label}</Link>)}</div></div>;}
