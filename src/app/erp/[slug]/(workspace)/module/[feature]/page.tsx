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
import {businessCanReport} from "@/features/business/businessAccess";
import {BusinessWorkflowWorkspace} from "@/features/business/BusinessWorkflowWorkspace";
export default async function Page({params}:{params:Promise<{slug:string;feature:string}>}){const {slug,feature}=await params;const w=await readBusinessWorkspace(slug);if(!featureKeys.includes(feature as BusinessFeature)||!w.features.includes(feature as BusinessFeature))notFound();const f=feature as BusinessFeature;const reports:BusinessFeature[]=f==="crm"?["crm","people","sales","inventory"]:f==="assets"||f==="costing"||f==="accounting"?["accounting","costing","assets","people","purchasing"]:f==="purchasing"?["purchasing","inventory","accounting"]:f==="projects"?["projects","purchasing","costing","accounting","people"]:[f];if(!businessCanReport(w,reports))return <BusinessScopedModule workspace={w} feature={f}/>;return feature==="crm"&&w.features.includes("people")?<BusinessCrmWorkspace workspace={w}/>:feature==="accounting"?<BusinessAccountingWorkspace workspace={w}/>:feature==="purchasing"?<BusinessProcurementWorkspace workspace={w}/>:feature==="people"?<BusinessPeopleWorkspace workspace={w}/>:feature==="projects"?<BusinessWorkflowWorkspace workspace={w} view="projects"/>:feature==="assets"||feature==="costing"?<BusinessMisaWorkspace workspace={w} initialView={feature}/>:<BusinessModuleWorkspace workspace={w} feature={f}/>;}
