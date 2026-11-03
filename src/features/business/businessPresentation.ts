import {businessEntities,entitiesForFeature,type EntityField,type EntityKind,type BusinessFeature} from "./businessCatalog";
import {businessCan} from "./businessAccess";
import type {BusinessWorkspace} from "./businessSchemas";
export function businessSearchText(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLocaleLowerCase("vi").trim();}
export const navigationGroups=[{key:"documents",label:"Chứng từ"},{key:"catalogs",label:"Danh mục"},{key:"details",label:"Chi tiết"}] as const;
export function businessNavigation(workspace:BusinessWorkspace,feature:BusinessFeature,query=""){
 const kinds=entitiesForFeature(workspace.industry,workspace.features,feature).filter(kind=>businessCan(workspace,kind,"read")&&businessSearchText(businessEntities[kind].label).includes(businessSearchText(query)));
 return navigationGroups.map(group=>({...group,kinds:kinds.filter(kind=>{const definition=businessEntities[kind];return (definition.parentKind?"details":definition.mode==="master"?"catalogs":"documents")===group.key;})})).filter(group=>group.kinds.length);
}
export type RecordFieldEntry=[string,EntityField];
export function recordFormGroups(entries:RecordFieldEntry[]){
 if(entries.length<=6)return [{key:"details",label:"Thông tin chi tiết",fields:entries}];
 return [{key:"references",label:"Đối tượng & liên kết",types:["ref"]},{key:"dates",label:"Thời gian",types:["date","time"]},{key:"amounts",label:"Giá trị & số lượng",types:["number"]},{key:"details",label:"Thông tin chi tiết",types:["text","email","enum","boolean"]}].map(group=>({...group,fields:entries.filter(([,field])=>group.types.includes(field.type))})).filter(group=>group.fields.length);
}
export function defaultRecordColumns(kind:EntityKind,entries:RecordFieldEntry[]){
 if(entries.length<=4)return entries.map(([key])=>key);
 const keyFields=[...(businessEntities[kind].mode==="master"?["unit","tracking","standard_cost","partner_type"]:["amount","total_amount","quantity"]),"partner_id","supplier_id","staff_id","project_id","item_id","document_date","posting_date","order_date","due_date"];
 const preferred=keyFields.filter(key=>entries.some(([candidate])=>candidate===key));
 return [...new Set([...preferred,...entries.map(([key])=>key)])].slice(0,4);
}
export function recordFieldText(row:Record<string,unknown>,key:string,field:EntityField){
 const value=row[key];if(value===null||value===undefined||value==="")return "—";
 if(field.type==="boolean")return value===true?"Có":"Không";
 if(field.type==="enum")return field.values?.[String(value)]??String(value);
 if(field.type==="ref")return (row.references as Record<string,string>|undefined)?.[key]??"—";
 if(field.type==="number")return Number(value).toLocaleString("vi-VN",{maximumFractionDigits:4});
 if(field.type==="date"&&/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return String(value).split("-").reverse().join("/");
 return String(value);
}
