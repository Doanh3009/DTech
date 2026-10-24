import { AppError } from "@/lib/api/errors";
import type { CrmCustomer } from "./crmSchemas";
import { crmProfileSchema, crmSetupSchema, provisioningIssues } from "./crmSchemas";

export function customerDeploymentManifest(customer:CrmCustomer, operatorRef?:string){
 const p=crmProfileSchema.parse(customer.profile);const s=crmSetupSchema.parse(customer.setup);
 const protectedRefs=["tcjjhxqtreemccdbvyza","uioywupuuestcaliawlc","lgmlkagcytfjazulgfbz",...(operatorRef?[operatorRef]:[])];
 if(provisioningIssues(p,s).length||protectedRefs.includes(s.projectRef))throw new AppError("CONFLICT","Hoàn thiện thông tin khảo sát và môi trường riêng trước khi xuất manifest.");
 return {schemaVersion:1,deploymentId:s.deploymentId,name:s.systemName,projectRef:s.projectRef,dashboardUrl:`https://supabase.com/dashboard/project/${s.projectRef}`,apiUrl:`https://${s.projectRef}.supabase.co`,provisioningMode:"existing-project",organizationId:s.organizationId,region:s.region,migrationsDirectory:"supabase/migrations",includeDevelopmentSeed:false,
 customer:{companyName:p.companyName,shortName:s.shortName,systemName:s.systemName,address:p.address,phone:p.phone,email:p.email,taxCode:p.taxCode,representativeName:""},branding:{systemName:s.systemName,loginSubtitle:"",logoMainUrl:null,logoCompactUrl:null,logoDarkUrl:null,faviconUrl:null,assetVersion:0},industryPreset:s.industryPreset,enabledModules:s.enabledModules,localization:{timezone:"Asia/Ho_Chi_Minh",locale:"vi-VN"},application:{baseUrl:new URL(s.baseUrl).origin,environment:s.environment},admin:{username:s.adminUsername,displayName:s.adminDisplayName,employeeCode:s.adminEmployeeCode},protectedExistingProjectRefs:[...new Set(protectedRefs)]};
}
