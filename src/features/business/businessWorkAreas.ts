import registry from "@/config/businessWorkAreas.json";
import {businessEntities,entitiesForFeature,type BusinessFeature,type EntityKind} from "./businessCatalog";
import {businessCan} from "./businessAccess";
import type {BusinessWorkspace} from "./businessSchemas";

interface AreaDefinition {key:string;label:string;secondary?:boolean;kinds:EntityKind[]}
export interface BusinessWorkArea extends AreaDefinition {contextualKinds:EntityKind[]}
const definitions=registry as Record<BusinessFeature,AreaDefinition[]>;
// These generated details predate parentKind metadata; their working screen is
// already embedded in the parent document or its calculation/ledger panel.
const contextualParents:Partial<Record<EntityKind,EntityKind>>={journal_lines:"journal_entries",asset_charge_lines:"asset_charge_runs",stock_valuation_lines:"stock_valuation_runs",costing_lines:"costing_runs",tax_filing_lines:"tax_filings",payroll_statutory_lines:"payroll_tax_runs"};

export function businessWorkAreas(workspace:BusinessWorkspace,feature:BusinessFeature):BusinessWorkArea[]{
 const allowed=entitiesForFeature(workspace.industry,workspace.features,feature).filter(kind=>businessCan(workspace,kind,"read")),available=new Set(allowed);
 const areas=definitions[feature].map(area=>({...area,kinds:area.kinds.filter(kind=>available.has(kind)),contextualKinds:[] as EntityKind[]}));
 const assigned=new Set(areas.flatMap(area=>area.kinds));
 for(const kind of allowed){
  if(assigned.has(kind))continue;
  const parent=businessEntities[kind].parentKind??contextualParents[kind];
  const area=parent?areas.find(candidate=>candidate.kinds.includes(parent)):undefined;
  if(area){area.contextualKinds.push(kind);assigned.add(kind);}
 }
 // A role allowed to read a detail without its parent still has an explicit
 // working route; future registry additions never silently disappear either.
 const remaining=allowed.filter(kind=>!assigned.has(kind));
 if(remaining.length)areas.push({key:"other",label:"Công cụ khác",secondary:true,kinds:remaining,contextualKinds:[]});
 return areas.filter(area=>area.kinds.length||area.contextualKinds.length);
}

export function businessAreaForKind(workspace:BusinessWorkspace,feature:BusinessFeature,kind:EntityKind){
 return businessWorkAreas(workspace,feature).find(area=>area.kinds.includes(kind)||area.contextualKinds.includes(kind));
}

export function businessWorkAreaHref(slug:string,feature:BusinessFeature,area:BusinessWorkArea,kind?:EntityKind){
 const selected=kind??area.kinds[0]??area.contextualKinds[0];
 return `/erp/${slug}/module/${feature}?${new URLSearchParams({area:area.key,view:selected})}`;
}
