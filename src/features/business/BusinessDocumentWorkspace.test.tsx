import {render,screen,within} from "@testing-library/react";
import {describe,expect,it} from "vitest";
import {BusinessDocumentWorkspace} from "./BusinessDocumentWorkspace";
import type {BusinessWorkspace} from "./businessSchemas";
const workspace={slug:"acme",industry:"construction",features:["inventory","purchasing","crm"],role:"owner"} as BusinessWorkspace;
const selected={id:"order",code:"PO-2026-01",name:"Mua vật tư công trình",status:"draft",partner_id:"supplier-a",order_date:"2026-11-05",expected_on:"2026-11-07",project_id:"private-project",references:{partner_id:"Công ty vật tư A",project_id:"Công trình riêng tư"}};
describe("document workbench",()=>{
 it("renders actual identity, status, dates and document/line content together",()=>{
  render(<BusinessDocumentWorkspace workspace={workspace} kind="purchase_orders" data={selected} selected={selected} dirty navigation={<nav aria-label="Các phần chứng từ">Chứng từ · Duyệt · Tệp</nav>} summary={<span>Giá trị đã đối chiếu: 1.200.000 đ</span>}><form aria-label="Thông tin đơn mua"><input aria-label="Ngày đặt mua" value={selected.order_date} readOnly/></form><section aria-label="Dòng vật tư">Vật tư đã lưu</section></BusinessDocumentWorkspace>);
  expect(screen.getByText(selected.code)).toBeVisible();expect(screen.getByText(selected.name)).toBeVisible();expect(screen.getByText("Công ty vật tư A")).toBeVisible();expect(screen.getByText("05/11/2026")).toBeVisible();expect(screen.getByText("Chưa lưu")).toBeVisible();expect(screen.getByRole("form",{name:"Thông tin đơn mua"})).toBeVisible();expect(screen.getByRole("region",{name:"Dòng vật tư"})).toBeVisible();expect(screen.getByText(/Giá trị đã đối chiếu/)).toBeVisible();expect(screen.queryByRole("heading")).not.toBeInTheDocument();
 });
 it("does not show stale reference names after the field changes or raw record IDs",()=>{
  render(<BusinessDocumentWorkspace workspace={workspace} kind="purchase_orders" data={{...selected,partner_id:"supplier-b",references:undefined}} selected={selected}><div>Content</div></BusinessDocumentWorkspace>);
  expect(screen.queryByText("Công ty vật tư A")).not.toBeInTheDocument();expect(screen.queryByText("supplier-b")).not.toBeInTheDocument();expect(screen.queryByText("Công trình riêng tư")).not.toBeInTheDocument();
 });
 it("hides metadata for reference kinds the actor cannot read",()=>{
  render(<BusinessDocumentWorkspace workspace={{...workspace,role:"editor",customAccess:true,grants:[{kind:"purchase_orders",scope:"tenant",actions:["read"],project_ids:[],department:""}]}} kind="purchase_orders" data={selected} selected={selected}><div>Content</div></BusinessDocumentWorkspace>);
  expect(screen.queryByText("Công ty vật tư A")).not.toBeInTheDocument();expect(screen.getByText("05/11/2026")).toBeVisible();
 });
 it("uses only placeholders for a new document and no invented financial totals",()=>{
  render(<BusinessDocumentWorkspace workspace={workspace} kind="purchase_orders" data={{code:"",name:""}} selected={null}><div>New form</div></BusinessDocumentWorkspace>);
  const root=screen.getByRole("region",{name:"Đơn mua hàng"});expect(within(root).getByText("Chưa cấp số")).toBeVisible();expect(within(root).getByText("Nháp")).toBeVisible();expect(root.querySelector('[data-ui="business-document-summary"]')).toBeNull();
 });
});
