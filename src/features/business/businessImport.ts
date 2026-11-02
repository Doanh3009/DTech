import {z} from "zod";
import catalogs from "@/config/businessImportCatalogs.json";
import {businessEntities,emptyRecord,recordSchema,type EntityKind} from "./businessCatalog";
import {businessCan} from "./businessAccess";
import type {BusinessWorkspace} from "./businessSchemas";

export type ImportKind=keyof typeof catalogs;
export const importKindSchema=z.enum(Object.keys(catalogs) as [ImportKind,...ImportKind[]]);
export const importLimits={fileBytes:1024*1024,expandedBytes:8*1024*1024,columns:16,rows:200} as const;
export type ImportCell=string|number|null;
export interface ImportSourceRow {rowNumber:number;values:Record<string,ImportCell>;errors:string[]}
export interface ImportMatch {code:string;recordId:string;rowVersion:number;status:string;data:Record<string,unknown>}
export interface ImportPreviewRow {rowNumber:number;recordId:string;rowVersion:number;code:string;name:string;data:Record<string,unknown>;previousData?:Record<string,unknown>;errors:string[];existing:boolean;canCreate:boolean;canUpdate:boolean}
export interface ImportResultRow {rowNumber:number;code:string;action:"create"|"update";status:"created"|"updated"|"failed";recordId?:string;rowVersion?:number;errorCode?:string}
export interface ImportReceipt {requestId:string;created:number;updated:number;failed:number;results:ImportResultRow[]}
export interface ImportHistory {requestId:string;fileName:string;createdAt:string;created:number;updated:number;failed:number}
export interface ImportPreview {fileName:string;fileHash:string;rows:ImportPreviewRow[]}
const rowSchema=z.object({rowNumber:z.number().int().min(2).max(importLimits.rows+1),action:z.enum(["create","update"]),recordId:z.string().uuid(),rowVersion:z.number().int().nonnegative(),data:z.record(z.string(),z.unknown())}).strict();
export const importCommitSchema=z.object({requestId:z.string().uuid(),fileName:z.string().trim().min(1).max(180),fileHash:z.string().regex(/^[a-f0-9]{64}$/),rows:z.array(rowSchema).min(1).max(importLimits.rows)}).strict().superRefine((value,context)=>{
 if(new Set(value.rows.map(row=>row.rowNumber)).size!==value.rows.length)context.addIssue({code:"custom",message:"Dòng nhập bị trùng."});
 if(value.rows.some(row=>row.action==="create"?row.rowVersion!==0:row.rowVersion<1))context.addIssue({code:"custom",message:"Phiên bản không khớp thao tác nhập."});
});
export type ImportCommit=z.infer<typeof importCommitSchema>;
export function isImportKind(kind:EntityKind):kind is ImportKind{return Object.hasOwn(catalogs,kind);}
export function canImportCatalog(w:BusinessWorkspace,kind:EntityKind){
 return isImportKind(kind)&&businessCan(w,kind,"read")&&(businessCan(w,kind,"create")||businessCan(w,kind,"update"))&&(w.role==="owner"||!w.customAccess||w.grants?.some(grant=>grant.kind===kind&&grant.scope==="tenant"));
}
export function importColumns(kind:ImportKind){return [{key:"code",label:"Mã"},{key:"name",label:"Tên"},...Object.entries(businessEntities[kind].fields).filter(([,field])=>!field.computed).map(([key,field])=>({key,label:field.label})),{key:"notes",label:"Ghi chú"}];}
const key=(value:string)=>value.normalize("NFC").trim().toLocaleLowerCase("vi");
export function resolveImportHeaders(kind:ImportKind,headers:string[]){
 const columns=importColumns(kind),seen=new Set<string>();
 const result=headers.map(header=>{const column=columns.find(column=>key(column.key)===key(header)||key(column.label)===key(header));if(!column)throw Error(`Cột không hỗ trợ: ${header.slice(0,80)||"(trống)"}.`);if(seen.has(column.key))throw Error(`Cột bị trùng: ${column.label}.`);seen.add(column.key);return column.key;});
 if(!seen.has("code")||!seen.has("name"))throw Error("Tệp cần có cột Mã và Tên.");return result;
}
export function prepareImportRows(kind:ImportKind,source:ImportSourceRow[],matches:ImportMatch[],w:BusinessWorkspace):ImportPreviewRow[]{
 const found=new Map(matches.map(match=>[key(match.code),match]));const counts=new Map<string,number>();
 for(const row of source){const code=key(String(row.values.code??""));counts.set(code,(counts.get(code)??0)+1);}
 return source.map(row=>{
  const code=String(row.values.code??"").normalize("NFC").trim(),match=found.get(key(code));const errors=[...row.errors];
  const data:Record<string,unknown>={...emptyRecord(kind,w.industry),...match?.data};
  for(const[column,raw]of Object.entries(row.values)){
   const field=businessEntities[kind].fields[column];let value:unknown=typeof raw==="string"?raw.normalize("NFC").trim():raw;
   if(field?.type==="number"){
    if(value===""||value===null)value=field.default??(field.required?null:0);
    else if(typeof value==="string"&&/^-?\d+(?:\.\d+)?$/.test(value))value=Number(value);
    else if(typeof value!=="number")errors.push(`${field.label}: dùng ô số hoặc số thập phân với dấu chấm.`);
   }else if(field?.type==="enum"){
    value=Object.keys(field.values??{}).find(candidate=>key(candidate)===key(String(value??""))||key(field.values![candidate])===key(String(value??"")))??value;
    if(value===""||value===null)value=field.default??null;
   }else if(field)value=value===""||value===null?field.required?"":null:String(value);
   else value=String(value??"");
   data[column]=value;
  }
  data.code=code;const parsed=recordSchema(kind).safeParse(data);
  if(!parsed.success)for(const issue of parsed.error.issues){const column=String(issue.path[0]);errors.push(`Kiểm tra ${businessEntities[kind].fields[column]?.label??({code:"Mã",name:"Tên",notes:"Ghi chú"} as Record<string,string>)[column]??column}.`);}
  if((counts.get(key(code))??0)>1)errors.push("Mã bị trùng trong tệp.");
  return {rowNumber:row.rowNumber,recordId:match?.recordId??crypto.randomUUID(),rowVersion:match?.rowVersion??0,code,name:String(data.name??""),data:parsed.success?parsed.data:data,...(match?{previousData:match.data}:{}),errors:[...new Set(errors)],existing:!!match,canCreate:businessCan(w,kind,"create"),canUpdate:businessCan(w,kind,"update")};
 });
}
export const importErrorLabels:Record<string,string>={BUSINESS_VERSION_CONFLICT:"Dữ liệu đã thay đổi. Kiểm tra lại tệp trước khi nhập.",BUSINESS_DUPLICATE:"Mã đã tồn tại. Kiểm tra lại và chọn cập nhật.",BUSINESS_ITEM_UNIT_LOCKED:"Vật tư đã có tham chiếu; không thể đổi đơn vị cơ sở.",BUSINESS_RECORD_LOCKED:"Bản ghi đang khóa.",BUSINESS_INVALID_INPUT:"Dữ liệu không hợp lệ."};
export function importErrorsCsv(rows:{rowNumber:number;code:string;errors:string[]}[]){const cell=(value:unknown)=>{let text=String(value??"");if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};return "\uFEFF"+[["Dòng","Mã","Lỗi"],...rows.filter(row=>row.errors.length).map(row=>[row.rowNumber,row.code,row.errors.join("; ")])].map(row=>row.map(cell).join(",")).join("\r\n");}
