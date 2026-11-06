import type {ReactNode} from "react";
import {FileText} from "lucide-react";
import {StatusBadge} from "@/components/shared/StatusBadge";
import {businessEntities,entitiesFor,recordStates,type EntityKind} from "./businessCatalog";
import {businessCan} from "./businessAccess";
import type {BusinessWorkspace} from "./businessSchemas";
import styles from "./BusinessDocumentWorkspace.module.css";

export const businessDocumentDrawerClassName=styles.documentDrawer;
export interface BusinessDocumentWorkspaceProps {
 workspace:BusinessWorkspace;
 kind:EntityKind;
 data:Record<string,unknown>;
 selected:Record<string,unknown>|null;
 dirty?:boolean;
 navigation?:ReactNode;
 notices?:ReactNode;
 summary?:ReactNode;
 children:ReactNode;
}

function text(value:unknown){return typeof value==="string"?value.trim():"";}
function reference(source:unknown,key:string){return source&&typeof source==="object"?text((source as Record<string,unknown>)[key]):"";}
const metadataKeys=["partner_id","warehouse_id","project_id","work_order_id","order_date","document_date","posting_date","expected_on","due_date","due_on"];

export function BusinessDocumentWorkspace({workspace:w,kind,data,selected,dirty=false,navigation,notices,summary,children}:BusinessDocumentWorkspaceProps){
 const definition=businessEntities[kind],allowed=entitiesFor(w.industry,w.features),state=text(selected?.status)||"draft",code=text(data.code??selected?.code),name=text(data.name??selected?.name);
 const metadata=metadataKeys.flatMap(key=>{
  const field=definition.fields[key];if(!field||field.readRoles&&!field.readRoles.includes(w.role)||field.requiresFeature&&!w.features.includes(field.requiresFeature)||field.ref&&(!allowed.includes(field.ref)||!businessCan(w,field.ref,"read")))return[];
  const value=Object.hasOwn(data,key)?data[key]:selected?.[key];if(value===null||value===undefined||value==="")return[];
  const label=field.type==="ref"?reference(data.references,key)||(selected?.[key]===value?reference(selected?.references,key):""):field.type==="date"&&/^\d{4}-\d{2}-\d{2}$/.test(String(value))?String(value).split("-").reverse().join("/"):"";
  return label?[{key,label:field.label,value:label}]:[];
 }).slice(0,4);
 return <section className={styles.workspace} data-ui="business-document-workspace" aria-label={definition.label}>
  <header className={styles.identity}>
   <div className={styles.identityMain}><span className={styles.documentIcon}><FileText size={21} aria-hidden="true"/></span><div className={styles.identityCopy}><span className={styles.documentType}>{definition.label}</span><div className={styles.codeRow}><strong>{code||(definition.mode==="master"?"Chưa nhập mã":"Chưa cấp số")}</strong><StatusBadge tone={state==="draft"?"neutral":state==="cancelled"||state==="inactive"?"warning":"success"}>{!selected&&definition.mode==="master"?"Bản ghi mới":recordStates[state as keyof typeof recordStates]??"Nháp"}</StatusBadge>{dirty?<StatusBadge tone="warning">Chưa lưu</StatusBadge>:null}</div>{name?<span className={styles.documentName}>{name}</span>:null}</div></div>
   {metadata.length?<dl className={styles.metadata}>{metadata.map(item=><div key={item.key}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>:null}
  </header>
  {navigation?<div className={styles.navigation} data-ui="business-document-navigation">{navigation}</div>:null}
  <div className={styles.body} data-ui="business-document-body">{notices?<div className={styles.notices}>{notices}</div>:null}<div className={styles.content}>{children}</div></div>
  {summary?<div className={styles.summary} data-ui="business-document-summary">{summary}</div>:null}
 </section>;
}
