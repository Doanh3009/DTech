import{describe,expect,it}from"vitest";
import{businessEntities,type EntityKind}from"./businessCatalog";
import{businessDocumentGroups,businessRecordNameLabel}from"./businessDocumentLayouts";
describe("document form workflow layout",()=>{
 it.each(["purchase_orders","sales_orders","purchase_receipts","stock_moves","vendor_invoices","sales_invoices","cash_vouchers","work_orders","boms","salary_runs"] as EntityKind[])("keeps every available field once in the business layout: %s",kind=>{
  const fields=Object.entries(businessEntities[kind].fields),groups=businessDocumentGroups(kind,fields),actual=groups.flatMap(group=>group.fields.map(([key])=>key));
  expect(actual).toHaveLength(fields.length);expect(new Set(actual).size).toBe(fields.length);expect([...actual].sort()).toEqual(fields.map(([key])=>key).sort());
 });
 it("puts the supplier and receiving dates together instead of splitting fields by type",()=>{const groups=businessDocumentGroups("purchase_orders",Object.entries(businessEntities.purchase_orders.fields));expect(groups[0].label).toBe("Đối tác & lịch nhận");expect(groups[0].fields.map(([key])=>key)).toEqual(["partner_id","order_date","expected_on","project_id"]);});
 it("uses an explanation field for documents and a name for catalogs",()=>{expect(businessRecordNameLabel("purchase_orders")).toBe("Diễn giải");expect(businessRecordNameLabel("items")).toBe("Tên");expect(businessRecordNameLabel("purchase_lines")).toBe("Diễn giải");});
});
