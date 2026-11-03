import {businessEntities,emptyRecord,type BusinessIndustry,type EntityKind} from "./businessCatalog";
const currentDateKeys=new Set(["document_date","posting_date","order_date","requested_on","reported_on","opened_on","offered_on","received_on","incident_date","work_date","meeting_date"]);
const periodKinds=new Set<EntityKind>(["salary_runs","accounting_periods","attendance_locks","performance_cycles","tax_filings"]);
export function businessToday(){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());}
export function businessRecordDefaults(kind:EntityKind,industry?:BusinessIndustry,today=businessToday()){
 const values:Record<string,unknown>=emptyRecord(kind,industry);
 for(const key of Object.keys(values))if(currentDateKeys.has(key))values[key]=today;
 for(const[key,field]of Object.entries(businessEntities[kind].fields))if(field.uiGenerate==="uuid")values[key]=crypto.randomUUID();
 if(periodKinds.has(kind)){const[y,m]=today.split("-").map(Number);if("starts_on" in values)values.starts_on=today.slice(0,7)+"-01";if("ends_on" in values)values.ends_on=today.slice(0,7)+"-"+String(new Date(Date.UTC(y,m,0)).getUTCDate());}
 return values;
}
