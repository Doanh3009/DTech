import {describe,expect,it} from "vitest";
import {businessIndustries,businessIndustryKeys,entitiesForFeature,featureKeys,type EntityKind} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import {businessAreaForKind,businessWorkAreas,businessWorkAreaHref} from "./businessWorkAreas";

const workspace:BusinessWorkspace={tenantId:"10000000-0000-4000-8000-000000000001",slug:"acme",name:"Doanh nghiệp mẫu",systemName:"ERP mẫu",industry:"construction",features:featureKeys,status:"active",trialEndsAt:"2027-01-01",accountId:"10000000-0000-4000-8000-000000000002",displayName:"Quản lý",username:"owner",role:"owner",mustChangePassword:false};
describe("ERP work areas",()=>{
 it.each(businessIndustryKeys)("preserves every authorized entity exactly once in its module: %s",industry=>{
  const w={...workspace,industry,features:businessIndustries[industry].features} as BusinessWorkspace;
  for(const feature of w.features){
   const areas=businessWorkAreas(w,feature),kinds=areas.flatMap(area=>[...area.kinds,...area.contextualKinds]);
   expect(new Set(kinds).size).toBe(kinds.length);expect([...kinds].sort()).toEqual(entitiesForFeature(industry,w.features,feature).sort());
   expect(areas.filter(area=>!area.secondary).length).toBeLessThanOrEqual(6);expect(areas.some(area=>area.key==="other")).toBe(false);
  }
 });
 it("keeps document lines under their workflow and preserves their exact deep link destination",()=>{
  const area=businessAreaForKind(workspace,"purchasing","purchase_lines")!;
  expect(area.key).toBe("orders");expect(area.contextualKinds).toContain("purchase_lines");expect(area.kinds).not.toContain("purchase_lines");
  expect(businessWorkAreaHref("acme","purchasing",area,"purchase_lines")).toBe("/erp/acme/module/purchasing?area=orders&view=purchase_lines");
 });
 it("applies row-role capability filters and still exposes a granted detail without its parent",()=>{
  const w={...workspace,role:"editor",customAccess:true,grants:[{kind:"purchase_lines",scope:"tenant",actions:["read"]}]} as BusinessWorkspace;
  const areas=businessWorkAreas(w,"purchasing");expect(areas.flatMap(area=>[...area.kinds,...area.contextualKinds])).toEqual(["purchase_lines"]);
  expect(businessWorkAreaHref(w.slug,"purchasing",areas[0])).toContain("view=purchase_lines");
  expect(businessWorkAreas({...w,accessExpiresAt:"2020-01-01"},"purchasing")).toEqual([]);
 });
 it("keeps another module's workflow out of the area and supports the MES operation entry",()=>{
  expect(businessWorkAreas(workspace,"inventory").flatMap(area=>area.kinds)).not.toContain("purchase_orders");
  expect(businessAreaForKind(workspace,"mes","operations")?.kinds).toContain("operations");
 });
 it("places generated ledger and calculation details behind their actual parent screen",()=>{
  for(const[feature,detail,parent]of [["accounting","journal_lines","journal_entries"],["assets","asset_charge_lines","asset_charge_runs"],["costing","stock_valuation_lines","stock_valuation_runs"]] as const){
   const area=businessAreaForKind(workspace,feature,detail as EntityKind)!;expect(area.kinds).toContain(parent);expect(area.contextualKinds).toContain(detail);
  }
 });
});
