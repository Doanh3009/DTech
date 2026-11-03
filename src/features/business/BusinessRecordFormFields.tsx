"use client";
import {Input,Select,Textarea} from "@/components/shared/FormControls";
import {FormSection} from "@/components/shared/FormLayout";
import {businessEntities,entitiesFor,type EntityKind} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import {BusinessReference} from "./BusinessReference";
import {recordFormGroups,recordFieldText,type RecordFieldEntry} from "./businessPresentation";
import styles from "./Business.module.css";
export function BusinessRecordFormFields({workspace:w,kind,recordId,data,selected,disabled,errors,onChange}:{workspace:BusinessWorkspace;kind:EntityKind;recordId:string;data:Record<string,unknown>;selected:Record<string,unknown>|null;disabled:boolean;errors:Record<string,string>;onChange:(key:string,value:unknown)=>void}){
 const definition=businessEntities[kind],allowed=entitiesFor(w.industry,w.features);
 const entries=Object.entries(definition.fields).filter(([,field])=>(!field.requiresFeature||w.features.includes(field.requiresFeature))&&(!field.ref||allowed.includes(field.ref))&&(!field.computed||!!selected));
 function field([key,f]:RecordFieldEntry){
  const id=`${recordId}-${key}`,value=data[key],change=(value:unknown)=>onChange(key,value);
  if(f.computed)return <Input key={key} id={id} label={f.label} readOnly value={selected?recordFieldText(selected,key,f):"—"}/>;
  if(f.type==="boolean")return <Select key={key} id={id} label={f.label} error={errors[key]} value={value===true?"true":value===false?"false":""} disabled={disabled} required={f.required} options={[...(!f.required&&f.default===undefined?[{value:"",label:"Chưa chọn"}]:[]),{value:"true",label:"Có"},{value:"false",label:"Không"}]} onChange={event=>change(event.target.value===""?null:event.target.value==="true")}/>;
  if(f.type==="ref")return <BusinessReference key={recordId+key} id={id} slug={w.slug} kind={f.ref!} label={f.label} value={value?String(value):null} initialLabel={(selected?.references as Record<string,string>|undefined)?.[key]} required={f.required} disabled={disabled} validationError={errors[key]} onChange={change}/>;
  if(f.type==="enum")return <Select key={key} id={id} label={f.label} error={errors[key]} value={String(value??"")} disabled={disabled} required={f.required} options={[...(!f.required&&f.default===undefined?[{value:"",label:"Chưa chọn"}]:[]),...Object.entries(f.values!).map(([value,label])=>({value,label}))]} onChange={event=>change(event.target.value||null)}/>;
  if(f.type==="text"&&(f.max??240)>500)return <div key={key} className={styles.full}><Textarea id={id} label={f.label} error={errors[key]} value={String(value??"")} disabled={disabled} required={f.required} maxLength={f.max} rows={3} onChange={event=>change(event.target.value||null)}/></div>;
  return <Input key={key} id={id} label={f.label} error={errors[key]} type={f.type==="number"?"number":f.type==="date"?"date":f.type==="time"?"time":f.type==="email"?"email":"text"} min={f.min} max={f.type==="number"?f.max??1e15:undefined} step={f.type==="number"?(f.integer?1:"0.0001"):undefined} maxLength={f.type==="text"||f.type==="email"?f.max??240:undefined} required={f.required||f.default!==undefined||(kind==="lots"&&w.industry==="food_beverage"&&key==="expires_on")} disabled={disabled} value={value===null||value===undefined?"":String(value)} onChange={event=>change(event.target.value===""?null:f.type==="number"?Number(event.target.value):event.target.value)}/>;
 }
 return <div className={styles.recordForm}>
  <FormSection title="Thông tin chung">{(["code","name"] as const).map(key=><Input key={key} id={`${recordId}-${key}`} label={key==="code"?"Mã":"Tên"} error={errors[key]} required value={String(data[key]??"")} maxLength={key==="code"?50:180} disabled={disabled} onChange={event=>onChange(key,event.target.value)}/>)}</FormSection>
  {recordFormGroups(entries).map(group=><FormSection key={group.key} title={group.label}>{group.fields.map(field)}</FormSection>)}
  <Textarea id={`${recordId}-notes`} label="Ghi chú" error={errors.notes} rows={3} maxLength={2000} value={String(data.notes??"")} disabled={disabled} onChange={event=>onChange("notes",event.target.value)}/>
 </div>;
}
