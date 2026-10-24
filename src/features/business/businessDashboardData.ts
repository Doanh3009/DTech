export interface CompanyDashboardSnapshot {
 from:string;to:string;asOf:string;generatedAt:string;
 finance:null|{revenue:number;cashIn:number;cashOut:number;cashBalance:number;receivables:number;overdue:number;payables:number};
 trend:{starts_on:string;ends_on:string;revenue:number;cash_in:number;cash_out:number}[];
 work:{id:string;code:string;name:string;kind:string;status:string;target:number;actual:number;unit:string;progress?:number|null;cost?:number;due_date?:string;ends_on?:string|null;mold_code?:string|null;scrap?:number;labor_hours?:number;trace_count?:number;expires_on?:string|null}[];
 stock:null|{lots:number;blocked:number;expired:number;expiring:number};
 queues:{kind:string;total:number;review:number}[];
 alerts:{total:number;items:{code:string;name:string;kind:string;tone:string;state:string;amount:number|null;date:string|null}[]};
}
export const dashboardNumber=(n:number)=>Number(n).toLocaleString("vi-VN",{maximumFractionDigits:1});
export const dashboardMoney=(n:number)=>new Intl.NumberFormat("vi-VN",{notation:"compact",maximumFractionDigits:1}).format(n);
export function dashboardDate(v:string){const [y,m,d]=v.split("-");return `${d}/${m}/${y}`;}
