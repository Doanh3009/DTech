// @vitest-environment node
import { expect,it } from "vitest";
import { customerDeploymentManifest } from "./crmDeployment";
import { emptyProfile,emptySetup,type CrmCustomer } from "./crmSchemas";
const customer:CrmCustomer={customerId:"10000000-0000-4000-8000-000000000001",sourceRequestId:null,rowVersion:1,stage:"configuration",createdAt:"2026-10-23",updatedAt:"2026-10-23",profile:{...emptyProfile(),companyName:"Synthetic contractor",contactName:"Synthetic contact",email:"contact@example.invalid",phone:"0901234567",address:"Synthetic address",contactRole:"Director",needs:"Project operations",taxCode:"SYNTHETIC"},setup:{...emptySetup("construction"),shortName:"SYN",systemName:"Synthetic ERP",deploymentId:"synthetic-customer",projectRef:"abcdefghijklmnopqrst",organizationId:"zyxwvutsrqponmlkjihg",baseUrl:"https://customer.example.invalid",adminDisplayName:"Synthetic admin"}};
it("exports configuration that the actual deployment CLI accepts",async()=>{
 const filename="../../../../scripts/database/deployment-manifest.mjs";
 const {validateDeploymentManifest,settingsPreview}=await import(filename);
 const manifest=customerDeploymentManifest(customer);const validated=validateDeploymentManifest(manifest);expect(validated.legacy).toBe(false);const patches=settingsPreview(validated.target);expect(patches.organization).toMatchObject({companyName:customer.profile.companyName,address:customer.profile.address,taxCode:"SYNTHETIC",email:customer.profile.email,representativeName:""});expect(patches.branding).toEqual({systemName:customer.setup.systemName,loginSubtitle:"",logoMainUrl:null,logoCompactUrl:null,logoDarkUrl:null,faviconUrl:null,assetVersion:0});expect(manifest.protectedExistingProjectRefs).toContain("tcjjhxqtreemccdbvyza");expect(JSON.stringify(manifest)).not.toMatch(/password|serviceRoleKey|secret/i);
});
it("refuses incomplete setup or a target that belongs to the operator",()=>{
 expect(()=>customerDeploymentManifest({...customer,setup:emptySetup()})).toThrow();expect(()=>customerDeploymentManifest(customer,"abcdefghijklmnopqrst")).toThrow();
});
