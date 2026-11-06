import{render,screen,within}from"@testing-library/react";
import{describe,expect,it,vi}from"vitest";
import{BusinessRecordFormFields}from"./BusinessRecordFormFields";
import type{BusinessWorkspace}from"./businessSchemas";
vi.mock("./BusinessReference",()=>({BusinessReference:({label}:{label:string})=><input aria-label={label}/>}));
const workspace={slug:"acme",industry:"construction",features:["inventory","purchasing","crm","projects"],role:"owner"} as BusinessWorkspace;
const order={id:"10000000-0000-4000-8000-000000000001",code:"PO01",name:"Mua vật tư",status:"released",row_version:2,partner_id:"10000000-0000-4000-8000-000000000002",order_date:"2026-11-05",expected_on:"2026-11-12",project_id:null,procurement_award_id:null,notes:"",references:{partner_id:"NCC01 · Nhà cung cấp An Phú"}};
describe("document field presentation",()=>{
 it("keeps supplier and receiving schedule together with a meaningful document explanation label",()=>{
  render(<BusinessRecordFormFields workspace={workspace} kind="purchase_orders" recordId="po" data={order} selected={null} disabled={false} errors={{}} onChange={vi.fn()}/>);
  expect(screen.getByRole("textbox",{name:"Diễn giải"})).toHaveValue("Mua vật tư");expect(screen.queryByRole("textbox",{name:"Tên"})).toBeNull();
  const group=screen.getByRole("heading",{name:"Đối tác & lịch nhận"}).closest("section")!;expect(within(group).getByRole("textbox",{name:"Nhà cung cấp"})).toBeVisible();expect(within(group).getByLabelText(/Ngày dự kiến nhận/)).toBeVisible();
 });
 it("renders issued documents as readable values and hides empty internal computed sources",()=>{
  const {container}=render(<BusinessRecordFormFields workspace={workspace} kind="purchase_orders" recordId="po" data={order} selected={order} disabled readOnly errors={{}} onChange={vi.fn()}/>);
  expect(screen.getByText("NCC01 · Nhà cung cấp An Phú")).toBeVisible();expect(screen.getByText("12/11/2026")).toBeVisible();expect(container.querySelector("input,select,textarea")).toBeNull();expect(screen.queryByText("Nguồn lựa chọn NCC")).toBeNull();
 });
 it("keeps original entry units and canonical stock quantities visible on read-only receipts",()=>{
  const row={code:"PN01",name:"Nhận vật tư",status:"posted",entry_unit:"thùng",entry_quantity:2,entry_price:240000,quantity:24,unit_cost:20000,base_unit:"cái",unit_factor:12,document_date:"2026-11-05",notes:""};
  render(<BusinessRecordFormFields workspace={workspace} kind="purchase_receipts" recordId="pn" data={row} selected={row} disabled readOnly errors={{}} onChange={vi.fn()}/>);
  expect(screen.getByText("thùng")).toBeVisible();expect(screen.getByText("24")).toBeVisible();expect(screen.getByText("cái")).toBeVisible();expect(screen.getByText("240.000")).toBeVisible();
 });
});
