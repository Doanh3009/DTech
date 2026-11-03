import {dashboardMoney} from "./businessDashboardData";
import styles from "./Business.module.css";
export function BusinessMetricValue({value,currency=false,loading=false}:{value:number|null|undefined;currency?:boolean;loading?:boolean}){
 const present=!loading&&value!==null&&value!==undefined&&Number.isFinite(value);
 const full=present?value.toLocaleString("vi-VN",{maximumFractionDigits:2})+(currency?" đồng":""):undefined;
 return <strong className={styles.metricValue} title={full} aria-label={full}>{!present?"—":currency?<>{dashboardMoney(value)}<small> đ</small></>:Math.abs(value)>=1000000?new Intl.NumberFormat("vi-VN",{notation:"compact",maximumFractionDigits:1}).format(value):value.toLocaleString("vi-VN",{maximumFractionDigits:2})}</strong>;
}
