import {describe,expect,it} from "vitest";
import {canImportCatalog,importCommitSchema,importErrorsCsv,prepareImportRows,resolveImportHeaders,type ImportMatch,type ImportSourceRow} from "./businessImport";
import type {BusinessWorkspace} from "./businessSchemas";
const workspace={role:"owner",industry:"construction",features:["inventory","crm"]} as BusinessWorkspace;
const source=(values:ImportSourceRow["values"],rowNumber=2):ImportSourceRow=>({rowNumber,values,errors:[]});
const match:ImportMatch={code:"VT-01",recordId:"11111111-1111-4111-8111-111111111111",rowVersion:4,status:"active",data:{code:"VT-01",name:"Vật tư cũ",notes:"Giữ ghi chú",unit:"kg",tracking:"lot",standard_cost:12500}};
describe("business catalog import planning",()=>{
 it("accepts Vietnamese headings and canonical keys but rejects ambiguous duplicate aliases",()=>{expect(resolveImportHeaders("items",[" Mã ","name","Đơn vị tính"])).toEqual(["code","name","unit"]);expect(()=>resolveImportHeaders("items",["Mã","code","Tên"])).toThrow("trùng");expect(()=>resolveImportHeaders("items",["Mã","Tên","tenant_id"])).toThrow("không hỗ trợ");});
 it("preserves omitted fields on updates while explicit empty fields clear optional values",()=>{
  const [row]=prepareImportRows("items",[source({code:"vt-01",name:"Vật tư đổi tên"})],[match],workspace);expect(row).toMatchObject({recordId:match.recordId,rowVersion:4,existing:true,errors:[],data:{unit:"kg",tracking:"lot",standard_cost:12500,notes:"Giữ ghi chú"}});
  expect(prepareImportRows("partners",[source({code:"KH-01",name:"Khách hàng",email:""})],[{...match,code:"KH-01",data:{code:"KH-01",name:"Khách hàng",partner_type:"customer",phone:"0900000000",email:"old@example.test",tax_code:null,notes:""}}],workspace)[0].data).toMatchObject({phone:"0900000000",email:null});
 });
 it("marks all case-insensitive duplicates invalid and retains physical row numbers",()=>{const rows=prepareImportRows("items",[source({code:"VT-1",name:"Hàng A",unit:"kg"}),source({code:"vt-1",name:"Hàng B",unit:"kg"},8)],[],workspace);expect(rows.every(row=>row.errors.includes("Mã bị trùng trong tệp."))).toBe(true);expect(rows[1].rowNumber).toBe(8);});
 it("converts enum labels and exact decimal numbers without guessing thousands separators",()=>{
  const [valid]=prepareImportRows("items",[source({code:"A1",name:"Mặt hàng",unit:"kg",tracking:"Theo lô",standard_cost:"12500.25"})],[],workspace);expect(valid.errors).toEqual([]);expect(valid.data).toMatchObject({tracking:"lot",standard_cost:12500.25});
  expect(prepareImportRows("items",[source({code:"A1",name:"Mặt hàng",unit:"kg",standard_cost:"12,500"})],[],workspace)[0].errors.join(" ")).toContain("dấu chấm");
 });
 it("reports missing required fields and never accepts a privileged data column",()=>{expect(prepareImportRows("items",[source({code:"A1",name:"Mặt hàng"})],[],workspace)[0].errors.join(" ")).toContain("Đơn vị tính");expect(prepareImportRows("warehouses",[source({code:"K1",name:"Kho 1",tenant_id:"other"})],[],workspace)[0].errors.length).toBeGreaterThan(0);});
 it("requires tenant read scope and live write permissions for import controls",()=>{expect(canImportCatalog(workspace,"items")).toBe(true);expect(canImportCatalog({...workspace,role:"viewer"},"items")).toBe(false);expect(canImportCatalog({...workspace,role:"editor",customAccess:true,grants:[{kind:"items",actions:["read","create"],scope:"own",project_ids:[],department:""}]},"items")).toBe(false);expect(canImportCatalog(workspace,"stock_moves")).toBe(false);});
 it("rejects duplicate row identities and contradictory create/update versions",()=>{
  const row={rowNumber:2,action:"create",recordId:match.recordId,rowVersion:0,data:{}};const command={requestId:crypto.randomUUID(),fileName:"input.xlsx",fileHash:"a".repeat(64),rows:[row]};expect(importCommitSchema.safeParse(command).success).toBe(true);expect(importCommitSchema.safeParse({...command,rows:[row,row]}).success).toBe(false);expect(importCommitSchema.safeParse({...command,rows:[{...row,rowVersion:3}]}).success).toBe(false);
 });
 it("escapes spreadsheet formulas in downloadable error rows",()=>{const csv=importErrorsCsv([{rowNumber:2,code:"=WEBSERVICE(1)",errors:['Kiểm tra "Mã".']}]);expect(csv).toContain('"\'=WEBSERVICE(1)"');expect(csv).toContain('"Kiểm tra ""Mã""."');});
});
