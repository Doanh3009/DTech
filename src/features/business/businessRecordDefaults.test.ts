import{describe,expect,it}from"vitest";
import{businessRecordDefaults}from"./businessRecordDefaults";
import{recordSchema}from"./businessCatalog";
describe("business document entry defaults",()=>{
 it("sets transaction dates without inventing delivery commitments",()=>{const data=businessRecordDefaults("purchase_orders","construction","2026-11-03");expect(data.order_date).toBe("2026-11-03");expect(data.expected_on).toBe("");expect(data.code).toBe("");});
 it("uses the actual last day of the selected month including leap years",()=>{expect(businessRecordDefaults("salary_runs",undefined,"2028-02-14")).toMatchObject({starts_on:"2028-02-01",ends_on:"2028-02-29",posting_date:"2028-02-14"});});
 it("only relaxes an empty internal code when auto numbering is explicitly enabled",()=>{const data={...businessRecordDefaults("sales_orders",undefined,"2026-11-03"),name:"Đơn bán hàng",partner_id:"10000000-0000-4000-8000-000000000001",due_date:"2026-11-04"};expect(recordSchema("sales_orders").safeParse(data).success).toBe(false);expect(recordSchema("sales_orders",{autoCode:true}).safeParse(data).success).toBe(true);expect(recordSchema("sales_orders",{autoCode:true}).safeParse({...data,code:"<invalid>"}).success).toBe(false);});
});
