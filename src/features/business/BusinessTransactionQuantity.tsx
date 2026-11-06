"use client";

import {useEffect,useState} from "react";
import {Input,Select,type SelectOption} from "@/components/shared/FormControls";
import {Button} from "@/components/shared/Button";
import {businessEntities,type EntityKind} from "./businessCatalog";
import styles from "./Business.module.css";

type Units={baseUnit:string;effectiveOn:string;options:{unit:string;factor:number}[]};
type Lookup={key:string;units?:Units;error?:string};
type Props={
 slug:string;kind:EntityKind;data:Record<string,unknown>;selected:Record<string,unknown>|null;
 disabled:boolean;readOnly?:boolean;recordId:string;errors?:Record<string,string>;
 onChange:(key:string,value:unknown)=>void;
};
export const quantityEntryKeys=new Set(["entry_unit","entry_quantity","entry_price","unit_factor","unit_effective_on"]);

function isDate(value:unknown):value is string{
 return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
function parseUnits(value:unknown,effectiveOn:string):Units{
 const units=value as Units|null;
 if(!units||typeof units.baseUnit!=="string"||!units.baseUnit.trim()||units.baseUnit.length>30||units.effectiveOn!==effectiveOn||!Array.isArray(units.options)||!units.options.length||units.options.length>201||units.options.some(option=>!option||typeof option.unit!=="string"||!option.unit.trim()||option.unit.length>30||typeof option.factor!=="number"||!Number.isFinite(option.factor)||option.factor<=0))throw Error("Dữ liệu đơn vị tính chưa hợp lệ.");
 return units;
}
function numberValue(value:unknown){
 if(value===null||value===undefined||value==="")return undefined;
 const result=Number(value);return Number.isFinite(result)?result:undefined;
}
function format(value:number|undefined){
 if(value===undefined||!Number.isFinite(value))return "—";
 return value.toLocaleString("vi-VN",{maximumFractionDigits:8,...(value!==0&&Math.abs(value)<0.00000001?{notation:"scientific" as const}:{})});
}
const unitKey=(value:unknown)=>String(value??"").trim().toLocaleLowerCase("vi-VN");

export function BusinessTransactionQuantity({slug,kind,data,selected,disabled,readOnly=false,recordId,errors={},onChange}:Props){
 const definition=businessEntities[kind],configuration=definition.quantityEntry!;
 const itemId=String(data.item_id??""),parentId=String(data[definition.parentField??""]??""),date=String(data[configuration.dateField??""]??"");
 const [lookup,setLookup]=useState<Lookup|null>(null),[reload,setReload]=useState(0);
 const sealed=readOnly||!!selected&&!['draft','active','inactive'].includes(String(selected.status));
 const contextReady=!!itemId&&(configuration.dateField?isDate(date):!!parentId);
 const lookupKey=JSON.stringify([slug,kind,itemId,parentId,date,reload]);
 const current=lookup?.key===lookupKey?lookup:null;
 const units=sealed?undefined:current?.units,error=sealed?undefined:current?.error;
 const loading=!sealed&&contextReady&&!units&&!error;

 useEffect(()=>{
  const controller=new AbortController();
  if(!contextReady||sealed)return()=>controller.abort();
  // One deadline covers reading the parent date and the dependent unit list.
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
  async function read(){
   try{
    let effectiveOn=date;
    if(!configuration.dateField){
     const response=await fetch(`/api/v1/business/${slug}/records/${definition.parentKind}/${parentId}`,{cache:"no-store",signal});
     const body=await response.json();
     if(!response.ok||!body.ok)throw Error(body.error?.message??"Chưa tải được ngày đặt hàng.");
     effectiveOn=body.data?.order_date;
    }
    if(!isDate(effectiveOn))throw Error("Ngày chứng từ chưa hợp lệ.");
    const response=await fetch(`/api/v1/business/${slug}/items/${itemId}/units?on=${encodeURIComponent(effectiveOn)}`,{cache:"no-store",signal});
    const body=await response.json();
    if(!response.ok||!body.ok)throw Error(body.error?.message??"Chưa tải được đơn vị tính.");
    const result=parseUnits(body.data,effectiveOn);
    if(!controller.signal.aborted)setLookup({key:lookupKey,units:result});
   }catch(cause){
    if(!controller.signal.aborted)setLookup({key:lookupKey,error:signal.aborted?"Tải đơn vị tính quá thời gian. Thử lại.":cause instanceof Error?cause.message:"Chưa tải được đơn vị tính."});
   }
  }
  void read();return()=>controller.abort();
 },[slug,itemId,parentId,date,configuration.dateField,definition.parentKind,sealed,contextReady,lookupKey]);

 const sameRecord=!!selected&&itemId===String(selected.item_id??"")&&(!definition.parentField||parentId===String(selected[definition.parentField]??""));
 const effectiveOn=units?.effectiveOn||(configuration.dateField?date:undefined);
 const sameDate=sameRecord&&(sealed||effectiveOn===selected.unit_effective_on);
 const unit=String(data.entry_unit??units?.baseUnit??(sameDate?selected?.base_unit:"")??"");
 const quantity=data.entry_quantity??data.quantity,price=data.entry_price??data[configuration.priceField];
 const sameSnapshot=sameDate&&unitKey(unit)===unitKey(selected?.entry_unit);
 const factor=sameSnapshot?numberValue(selected?.unit_factor):units?.options.find(option=>unitKey(option.unit)===unitKey(unit))?.factor;
 const baseUnit=units?.baseUnit??(sameDate?String(selected?.base_unit??""):"");
 const options:SelectOption[]=units?.options.map(option=>({value:option.unit,label:option.unit}))??[];
 if(unit&&!options.some(option=>unitKey(option.value)===unitKey(unit)))options.unshift({value:unit,label:unit,disabled:!sameSnapshot});
 const selectedOption=options.find(option=>unitKey(option.value)===unitKey(unit));
 const unitError=errors.entry_unit??(!loading&&units&&unit&&!factor?"Đơn vị chưa có hiệu lực.":undefined);
 const controlsDisabled=disabled||sealed;
 const placeholder=loading?"Đang tải đơn vị…":!itemId?"Chọn vật tư trước":!contextReady&&!sealed?configuration.dateField?"Chọn ngày chứng từ":"Chọn đơn hàng":!unit?"Đơn vị cơ sở":undefined;
 const inputQuantity=numberValue(quantity),inputPrice=numberValue(price);
 const unchanged=sameSnapshot&&inputQuantity===numberValue(selected?.entry_quantity)&&inputPrice===numberValue(selected?.entry_price);
 const baseQuantity=unchanged?numberValue(selected?.quantity):inputQuantity!==undefined&&factor?Math.round(inputQuantity*factor*10000)/10000:undefined;
 const basePrice=unchanged?numberValue(selected?.[configuration.priceField]):inputPrice!==undefined&&factor?inputPrice/factor:undefined;
 function changeQuantity(value:number|null){
  if(controlsDisabled)return;
  onChange("entry_quantity",value);onChange("quantity",value);
  if(unit)onChange("entry_unit",unit);
  if(data.entry_price===null||data.entry_price===undefined)onChange("entry_price",price??0);
 }
 function changePrice(value:number|null){
  if(controlsDisabled)return;
  onChange("entry_price",value);onChange(configuration.priceField,value);
  if(unit)onChange("entry_unit",unit);
  if(data.entry_quantity===null||data.entry_quantity===undefined)onChange("entry_quantity",quantity??null);
 }
 return <div className={styles.full} role="group" aria-label="Số lượng và đơn vị" aria-busy={loading}><div className={styles.fields}>
  <Select id={`${recordId}-entry_unit`} label="Đơn vị nhập" value={selectedOption?.value??unit} options={options} placeholder={placeholder} disabled={controlsDisabled||loading||!contextReady||!!error} required={!!unit} error={unitError} onChange={event=>{
   if(controlsDisabled)return;
   onChange("entry_unit",event.target.value);onChange("entry_quantity",quantity??null);onChange("quantity",quantity??null);onChange("entry_price",price??0);onChange(configuration.priceField,price??0);
  }}/>
  <Input id={`${recordId}-quantity`} label="Số lượng nhập" type="number" min={0.0001} max={1e15} step="0.0001" required disabled={controlsDisabled} value={String(quantity??"")} error={errors.entry_quantity??errors.quantity} onChange={event=>changeQuantity(event.target.value===""?null:Number(event.target.value))}/>
  <Input id={`${recordId}-${configuration.priceField}`} label="Đơn giá theo đơn vị nhập" type="number" min={0} max={1e15} step="0.0001" required disabled={controlsDisabled} value={String(price??"")} error={errors.entry_price??errors[configuration.priceField]} onChange={event=>changePrice(event.target.value===""?null:Number(event.target.value))}/>
  <Input label="Hệ số quy đổi" readOnly value={format(factor)}/>
  <Input label="Số lượng cơ sở" readOnly value={baseQuantity===undefined?"—":`${format(baseQuantity)} ${baseUnit}`}/>
  <Input label="Đơn giá cơ sở" readOnly value={format(basePrice)}/>
 </div>{error?<div className="form-alert form-alert--error" role="alert">{error}<Button size="sm" type="button" disabled={controlsDisabled} onClick={()=>setReload(value=>value+1)}>Tải lại đơn vị</Button></div>:null}</div>;
}
