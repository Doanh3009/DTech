import{businessEntities,type EntityKind}from"./businessCatalog";

/** Legacy base-unit commands keep their wire shape through a staged rollout. */
export function businessRecordPayload(kind:EntityKind,data:Record<string,unknown>){
 const entries=["entry_unit","entry_quantity","entry_price"];
 if(!businessEntities[kind].quantityEntry||!entries.every(key=>data[key]===null))return data;
 return Object.fromEntries(Object.entries(data).filter(([key])=>!entries.includes(key)));
}
