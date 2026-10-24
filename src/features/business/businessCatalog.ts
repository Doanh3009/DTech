import { z } from "zod";
import industries from "@/config/businessIndustries.json";
import entities from "@/config/businessEntities.json";

export const businessIndustries=industries;
export type BusinessIndustry=keyof typeof industries;
export const businessIndustryKeys=Object.keys(industries) as [BusinessIndustry,...BusinessIndustry[]];
export const featureLabels={accounting:"Kế toán",purchasing:"Mua hàng",people:"Nhân sự & chấm công",inventory:"Kho & vật tư",production:"Quản lý sản xuất",mes:"Điều hành sản xuất",traceability:"Truy xuất lô",quality:"Chất lượng",sales:"Bán hàng & công nợ",crm:"Khách hàng",projects:"Công trình & chi phí",assets:"Tài sản & phân bổ",costing:"Giá thành & giá vốn"} as const;
export type BusinessFeature=keyof typeof featureLabels;
export const featureKeys=Object.keys(featureLabels) as [BusinessFeature,...BusinessFeature[]];
export type EntityKind=keyof typeof entities;
export interface EntityField {label:string;type:"text"|"email"|"number"|"date"|"time"|"enum"|"ref";required?:boolean;min?:number;max?:number;integer?:boolean;default?:string|number;computed?:boolean;requiresFeature?:BusinessFeature;ref?:EntityKind;values?:Record<string,string>}
export interface EntityDefinition {label:string;feature:BusinessFeature;workspaceFeature?:BusinessFeature;mode:"master"|"order"|"document";industries?:BusinessIndustry[];requiresFeatures?:BusinessFeature[];requiresApproval?:boolean;calculable?:boolean;generatedOnly?:boolean;lineKind?:EntityKind;parentKind?:EntityKind;parentField?:string;fields:Record<string,EntityField>}
export const businessEntities=entities as Record<EntityKind,EntityDefinition>;
export const entityKeys=Object.keys(entities) as [EntityKind,...EntityKind[]];
export const recordStates={draft:"Nháp",active:"Đang sử dụng",inactive:"Ngừng sử dụng",released:"Đang thực hiện",completed:"Hoàn thành",posted:"Đã ghi nhận",cancelled:"Đã hủy"} as const;
export function entitiesFor(industry:BusinessIndustry,features:readonly string[]){return entityKeys.filter(k=>{const e=businessEntities[k];return features.includes(e.feature)&&(!e.industries||e.industries.includes(industry))&&(!e.requiresFeatures||e.requiresFeatures.every(f=>features.includes(f)));});}
export function workspaceFeatureFor(kind:EntityKind,features:readonly string[]){const e=businessEntities[kind];return e?.workspaceFeature&&features.includes(e.workspaceFeature)?e.workspaceFeature:e?.feature;}
export function entitiesForFeature(industry:BusinessIndustry,features:readonly string[],feature:BusinessFeature){return entitiesFor(industry,features).filter(k=>workspaceFeatureFor(k,features)===feature);}
export function recordSchema(kind:EntityKind){
 const fields:Record<string,z.ZodTypeAny>={code:z.string().trim().min(1).max(50).regex(/^[\p{L}\p{N}._/-]+$/u),name:z.string().trim().min(2).max(180),notes:z.string().trim().max(2000)};
 for(const [key,f]of Object.entries(businessEntities[kind].fields)){
  if(f.computed)continue;
  let schema:z.ZodTypeAny;
  if(f.type==="number"){let n=z.number().finite().min(f.min??0).max(f.max??1e15);if(f.integer)n=n.int();schema=n;}
  else if(f.type==="ref")schema=z.string().uuid();
  else if(f.type==="enum")schema=z.enum(Object.keys(f.values!) as [string,...string[]]);
  else if(f.type==="date")schema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  else if(f.type==="time")schema=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/).transform(v=>v.slice(0,5));
  else if(f.type==="email")schema=z.string().trim().email().max(f.max??254);
  else schema=z.string().trim().min(f.required?1:0).max(f.max??240);
  fields[key]=f.required||f.default!==undefined?schema:z.union([schema,z.null()]);
 }
 return z.object(fields).strict().superRefine((data,ctx)=>{
  if(["vendor_invoices","sales_invoices"].includes(kind)&&Number(data.tax_amount)>0&&!data.tax_account_id)ctx.addIssue({code:z.ZodIssueCode.custom,path:["tax_account_id"],message:"Chọn tài khoản thuế."});
  const dates=kind==="sales_orders"?["order_date","due_date"]:kind==="purchase_orders"?["order_date","expected_on"]:kind==="salary_runs"||kind==="accounting_periods"?["starts_on","ends_on"]:kind==="vendor_invoices"||kind==="sales_invoices"?["document_date","due_date"]:null;
  if(dates&&String(data[dates[0]])>String(data[dates[1]]))ctx.addIssue({code:z.ZodIssueCode.custom,path:[dates[1]],message:"Ngày kết thúc phải từ ngày bắt đầu."});
 });
}
export function emptyRecord(kind:EntityKind,industry?:BusinessIndustry):Record<string,string|number|null>{return {code:"",name:"",notes:"",...Object.fromEntries(Object.entries(businessEntities[kind].fields).filter(([,f])=>!f.computed).map(([k,f])=>[k,k==="tracking"&&(industry==="electronics"||industry==="food_beverage")?"lot":f.default??(f.type==="number"?0:f.type==="enum"?Object.keys(f.values!)[0]:f.required?"":null)]))};}
export const featureDependencies:Partial<Record<BusinessFeature,BusinessFeature[]>>={production:["inventory"],mes:["inventory","production"],traceability:["inventory"],quality:["inventory"],sales:["inventory","crm"],projects:["inventory"],accounting:["crm"],purchasing:["inventory","crm"],assets:["accounting","crm"],costing:["accounting","inventory","crm"]};
export function selectBusinessFeature(current:BusinessFeature[],key:BusinessFeature,enabled:boolean){
 const next=new Set(current);
 if(enabled){const queue:BusinessFeature[]=[key];while(queue.length){const candidate=queue.shift()!;if(next.has(candidate)&&candidate!==key)continue;next.add(candidate);for(const dependency of featureDependencies[candidate]??[])if(!next.has(dependency))queue.push(dependency);}}
 else{next.delete(key);let changed=true;while(changed){changed=false;for(const candidate of next)if((featureDependencies[candidate]??[]).some(dependency=>!next.has(dependency))){next.delete(candidate);changed=true;}}}
 return [...next];
}
