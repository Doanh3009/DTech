import {businessEntities,type EntityKind} from "./businessCatalog";
import {recordFieldText,type RecordFieldEntry} from "./businessPresentation";

const amount=(value:unknown)=>value===null||value===undefined?"—":Number(value).toLocaleString("vi-VN",{maximumFractionDigits:4});
export function businessDocumentColumns(kind:EntityKind,fields:RecordFieldEntry[]){
 const quantity=businessEntities[kind].quantityEntry;
 return fields.map(([key,field],index)=>({
  id:key,header:quantity&&key==="quantity"?"Số lượng":quantity&&key===quantity.priceField?"Đơn giá":quantity&&key==="base_unit"?"Số lượng cơ sở":field.label,hiddenOnMobile:index>1,
  cell:(row:Record<string,unknown>)=>{
   if(quantity&&key==="quantity")return `${amount(row.entry_quantity??row.quantity)} ${String(row.entry_unit??row.base_unit??"")}`.trim();
   if(quantity&&key===quantity.priceField)return amount(row.entry_price??row[key]);
   if(quantity&&key==="base_unit")return `${amount(row.quantity)} ${String(row.base_unit??"")}`.trim();
   return recordFieldText(row,key,field);
  }
 }));
}
