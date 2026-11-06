import {PageHeader} from "@/components/shared/PageHeader";
import {featureLabels,type BusinessFeature} from "./businessCatalog";
import {BusinessAreaLinks} from "./BusinessAreaLinks";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./Business.module.css";
export function BusinessScopedModule({workspace:w,feature}:{workspace:BusinessWorkspace;feature:BusinessFeature}){return <div className={styles.stack}><PageHeader title={featureLabels[feature]}/><BusinessAreaLinks workspace={w} feature={feature}/></div>;}
