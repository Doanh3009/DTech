import{describe,expect,it}from"vitest";
import{emptyRecord,recordSchema}from"./businessCatalog";
import{businessRecordPayload}from"./businessRecordPayload";
const base={...emptyRecord("purchase_receipts"),code:"PN01",name:"Nhận hàng theo đơn",purchase_order_id:"10000000-0000-4000-8000-000000000001",item_id:"10000000-0000-4000-8000-000000000002",warehouse_id:"10000000-0000-4000-8000-000000000003",document_date:"2026-11-05",quantity:2,unit_cost:12000};
describe("base-unit command compatibility",()=>{
 it("sends the original base-unit schema when optional conversion inputs are unused",()=>{const parsed=recordSchema("purchase_receipts").parse(base),payload=businessRecordPayload("purchase_receipts",parsed);expect(payload).toMatchObject({quantity:2,unit_cost:12000});expect(payload).not.toHaveProperty("entry_unit");expect(payload).not.toHaveProperty("entry_quantity");expect(payload).not.toHaveProperty("entry_price");expect(parsed).toHaveProperty("entry_quantity",null);});
 it("keeps explicit conversion inputs intact for authoritative server normalization",()=>{const parsed=recordSchema("purchase_receipts").parse({...base,entry_unit:"thùng",entry_quantity:2,entry_price:240000});expect(businessRecordPayload("purchase_receipts",parsed)).toBe(parsed);});
 it("does not silently strip a partially supplied conversion or alter catalog payloads",()=>{const partial={...base,entry_quantity:3};expect(businessRecordPayload("purchase_receipts",partial)).toBe(partial);const item={unit:"kg",name:"Thép"};expect(businessRecordPayload("items",item)).toBe(item);});
});
