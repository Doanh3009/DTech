import { describe,it,expect } from "vitest";
import { crmProfileSchema,crmSetupSchema,crmSaveSchema,emptyProfile,emptySetup,provisioningIssues } from "./crmSchemas";
import { industryPresets } from "@/config/erpModules";
describe("operator customer schemas",()=>{
 const profile={...emptyProfile(),companyName:"Synthetic customer",contactName:"Synthetic contact",email:"contact@example.invalid",phone:"0901234567"};
 it("accepts complete draft without inventing deployment identifiers",()=>{expect(crmProfileSchema.safeParse(profile).success).toBe(true);expect(crmSetupSchema.safeParse(emptySetup()).success).toBe(true);expect(emptySetup().projectRef).toBe("");expect(provisioningIssues(profile,emptySetup()).length).toBeGreaterThan(0);});
 for(const preset of industryPresets)it(`uses shipped registry modules for ${preset.id}`,()=>{expect(emptySetup(preset.id).enabledModules).toEqual(preset.modules);expect(crmSetupSchema.safeParse(emptySetup(preset.id)).success).toBe(true);});
 for(const patch of [{enabledModules:["sales"]},{enabledModules:["warehouse","warehouse"]},{serviceRoleKey:"synthetic"},{baseUrl:"https://user:password@example.invalid"},{baseUrl:"http://localhost:3000"},{trialStartsOn:"2026-11-01",trialEndsOn:"2026-10-01"},{trialEndsOn:"2026-02-30"}])it(`rejects unsafe setup ${Object.keys(patch)[0]}`,()=>{expect(crmSetupSchema.safeParse({...emptySetup(),...patch}).success).toBe(false);});
 it("does not accept actor identity or credentials from input",()=>{expect(crmSaveSchema.safeParse({customerId:"10000000-0000-4000-8000-000000000001",rowVersion:0,profile,setup:emptySetup(),stage:"discovery",reason:"Created",actorId:"client"}).success).toBe(false);});
 it("canonicalizes customer origins before unique database constraints",()=>{expect(crmSetupSchema.parse({...emptySetup(),baseUrl:"https://CUSTOMER.example.invalid:443/"}).baseUrl).toBe("https://customer.example.invalid");});
});
