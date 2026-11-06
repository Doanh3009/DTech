import {BusinessCrmWorkspace} from "@/features/business/BusinessCrmWorkspace";
import {BusinessPeopleWorkspace} from "@/features/business/BusinessPeopleWorkspace";
import { notFound } from "next/navigation";
import { readBusinessWorkspace } from "@/features/business/businessService";
import { featureKeys, type BusinessFeature } from "@/features/business/businessCatalog";
import { BusinessModuleWorkspace } from "@/features/business/BusinessModuleWorkspace";
import { BusinessAccountingWorkspace } from "@/features/business/BusinessAccountingWorkspace";
import { BusinessProcurementWorkspace } from "@/features/business/BusinessProcurementWorkspace";
import { BusinessMisaWorkspace } from "@/features/business/BusinessMisaWorkspace";
import {BusinessScopedModule} from "@/features/business/BusinessScopedModule";
import {businessCan,businessCanReport} from "@/features/business/businessAccess";
import {BusinessWorkflowWorkspace} from "@/features/business/BusinessWorkflowWorkspace";
import {BusinessCollaborationWorkspace} from "@/features/business/BusinessCollaborationWorkspace";
import {BusinessQualityWorkspace} from "@/features/business/BusinessQualityWorkspace";
import {businessWorkAreas} from "@/features/business/businessWorkAreas";
import {BusinessWorkArea} from "@/features/business/BusinessWorkArea";
import {BusinessRecords} from "@/features/business/BusinessRecords";
import {BusinessProjectTasks} from "@/features/business/BusinessProjectTasks";

export default async function Page({params,searchParams}:{params:Promise<{slug:string;feature:string}>;searchParams:Promise<{area?:string;view?:string;q?:string}>}){
 const {slug,feature}=await params,w=await readBusinessWorkspace(slug);
 if(!featureKeys.includes(feature as BusinessFeature)||!w.features.includes(feature as BusinessFeature))notFound();
 const f=feature as BusinessFeature,query=await searchParams;
 if(query.area){
  const area=businessWorkAreas(w,f).find(candidate=>candidate.key===query.area);if(!area)notFound();
  const available=[...area.kinds,...area.contextualKinds],kind=available.find(candidate=>candidate===(query.view??available[0]));if(!kind)notFound();
  const search=query.q?.slice(0,100)??"";
  return <BusinessWorkArea workspace={w} feature={f} area={area} activeKind={kind}>{kind==="project_tasks"?<BusinessProjectTasks workspace={w}/>:<BusinessRecords key={kind+search} workspace={w} kind={kind} initialQuery={search}/>}</BusinessWorkArea>;
 }
 const reports:BusinessFeature[]=f==="crm"?["crm","people","sales","inventory"]:f==="assets"||f==="costing"||f==="accounting"?["accounting","costing","assets","people","purchasing"]:f==="purchasing"?["purchasing","inventory","accounting"]:f==="projects"?["projects","purchasing","costing","accounting","people"]:[f];
 if(feature==="collaboration")return businessCan(w,"meetings","read")?<BusinessCollaborationWorkspace workspace={w}/>:notFound();
 if(!businessCanReport(w,reports))return <BusinessScopedModule workspace={w} feature={f}/>;
 return feature==="crm"&&w.features.includes("people")?<BusinessCrmWorkspace workspace={w}/>:feature==="accounting"?<BusinessAccountingWorkspace workspace={w}/>:feature==="purchasing"?<BusinessProcurementWorkspace workspace={w}/>:feature==="people"?<BusinessPeopleWorkspace workspace={w}/>:feature==="projects"?<BusinessWorkflowWorkspace workspace={w} view="projects"/>:feature==="quality"?<BusinessQualityWorkspace workspace={w}/>:feature==="assets"||feature==="costing"?<BusinessMisaWorkspace workspace={w} initialView={feature}/>:<BusinessModuleWorkspace workspace={w} feature={f}/>;
}
