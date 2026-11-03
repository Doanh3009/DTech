import {describe,expect,it} from "vitest";
import {businessEntities,businessIndustries,businessIndustryKeys,entitiesForFeature,workspaceFeatureFor,type EntityKind} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
import {businessNavigation,businessSearchText,defaultRecordColumns,recordFieldText,recordFormGroups} from "./businessPresentation";
const workspace={industry:"construction",features:businessIndustries.construction.features,role:"owner"} as BusinessWorkspace;
describe("business workspace presentation",()=>{
 it("matches Vietnamese labels without accents",()=>{expect(businessSearchText("  ĐƠN VỊ Quy đổi  ")).toBe("don vi quy doi");expect(businessNavigation(workspace,"inventory","quy doi").flatMap(group=>group.kinds)).toContain("item_unit_conversions");});
 it.each(businessIndustryKeys)("groups authorized navigation exactly once and within module ownership: %s",industry=>{
  const w={...workspace,industry,features:businessIndustries[industry].features} as BusinessWorkspace;
  for(const feature of w.features){const kinds=businessNavigation(w,feature).flatMap(group=>group.kinds);expect(new Set(kinds).size).toBe(kinds.length);expect([...kinds].sort()).toEqual(entitiesForFeature(industry,w.features,feature).sort());for(const kind of kinds)expect(workspaceFeatureFor(kind,w.features)).toBe(feature);}
 });
 it("removes entries with no read grant and expired access",()=>{const w={...workspace,role:"editor",customAccess:true,grants:[{kind:"items",scope:"tenant",actions:["read"]}]} as BusinessWorkspace;expect(businessNavigation(w,"inventory").flatMap(group=>group.kinds)).toEqual(["items"]);expect(businessNavigation({...w,accessExpiresAt:"2020-01-01"},"inventory")).toEqual([]);});
 it("retains every form field exactly once and limits default table columns",()=>{for(const [kind,definition] of Object.entries(businessEntities)){const fields=Object.entries(definition.fields),grouped=recordFormGroups(fields).flatMap(group=>group.fields.map(([key])=>key));expect(grouped.sort()).toEqual(fields.map(([key])=>key).sort());const columns=defaultRecordColumns(kind as EntityKind,fields);expect(columns.length).toBeLessThanOrEqual(4);expect(columns.every(key=>key in definition.fields)).toBe(true);}});
 it("formats reference labels, dates, enum states and absent values",()=>{expect(recordFieldText({partner_id:"private-id",references:{partner_id:"Công ty A"}},"partner_id",{label:"Đối tác",type:"ref"})).toBe("Công ty A");expect(recordFieldText({date:"2026-11-02"},"date",{label:"Ngày",type:"date"})).toBe("02/11/2026");expect(recordFieldText({state:"yes"},"state",{label:"Trạng thái",type:"enum",values:{yes:"Có"}})).toBe("Có");expect(recordFieldText({partner_id:"unresolved-id"},"partner_id",{label:"Đối tác",type:"ref"})).toBe("—");});
});
