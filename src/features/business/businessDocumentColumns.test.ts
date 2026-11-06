import {describe,expect,it} from "vitest";
import {businessEntities} from "./businessCatalog";
import {businessDocumentColumns} from "./businessDocumentColumns";
describe("document line quantity presentation",()=>{
 it("pairs entry quantity with entry price and shows the canonical stock quantity separately",()=>{
  const columns=businessDocumentColumns("purchase_lines",Object.entries(businessEntities.purchase_lines.fields));
  const row={quantity:24,unit_price:100/12,entry_quantity:2,entry_unit:"thùng",entry_price:100,base_unit:"cái"};
  expect(columns.find(column=>column.id==="quantity")?.cell(row)).toBe("2 thùng");
  expect(columns.find(column=>column.id==="unit_price")?.cell(row)).toBe("100");
  expect(columns.find(column=>column.id==="base_unit")?.cell(row)).toBe("24 cái");
 });
 it("preserves base-only and legacy rows without inventing a unit",()=>{
  const columns=businessDocumentColumns("sales_lines",Object.entries(businessEntities.sales_lines.fields));
  expect(columns.find(column=>column.id==="quantity")?.cell({quantity:3})).toBe("3");
  expect(columns.find(column=>column.id==="unit_price")?.cell({unit_price:12500})).toBe("12.500");
 });
 it("keeps document references and field permissions in the caller-selected column list",()=>{
  const columns=businessDocumentColumns("salary_lines",[["staff_id",businessEntities.salary_lines.fields.staff_id]]);
  expect(columns).toHaveLength(1);expect(columns[0].cell({staff_id:"hidden-id",references:{staff_id:"NV01 · Nhân viên"}})).toBe("NV01 · Nhân viên");
 });
});
