import {fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
import type {BusinessWorkspace} from "./businessSchemas";
import {BusinessRecords} from "./BusinessRecords";
vi.mock("./BusinessPurchaseReceiving",()=>({BusinessPurchaseReceiving:({order,onPendingChange}:{order:{id:string};onPendingChange:(v:boolean)=>void})=><section aria-label="Nhận hàng tại đơn" data-order={order.id}><button onClick={()=>onPendingChange(true)}>Nhập phiếu nhận</button></section>}));
vi.mock("./BusinessDocumentLines",()=>({BusinessDocumentLines:({onParentUpdated}:{onParentUpdated:(version:number,reviewedBy:null,origin:"read")=>void})=> <section aria-label="Dòng hàng chứng từ">Dòng hàng<button onClick={()=>onParentUpdated(2,null,"read")}>Đọc phiên bản cha mới</button></section>}));
vi.mock("./BusinessExtraForm",()=>({BusinessExtraForm:()=>null}));
vi.mock("./BusinessAttachments",()=>({BusinessAttachments:()=>null}));
vi.mock("./BusinessApprovalPanel",()=>({BusinessApprovalPanel:()=>null}));
vi.mock("./BusinessReference",()=>({BusinessReference:({label,value,onChange}:{label:string;value:string|null;onChange:(value:string)=>void})=><input aria-label={label} value={value??""} onChange={event=>onChange(event.target.value)}/>}));
const w={tenantId:"tenant",slug:"acme",industry:"construction",features:["inventory"],role:"owner",accountId:"owner"} as BusinessWorkspace;
const row={id:"10000000-0000-4000-8000-000000000001",code:"VT01",name:"Thép hộp",status:"active",row_version:3,unit:"kg",tracking:"none",standard_cost:12000,notes:null};
const response=(data:unknown)=>new Response(JSON.stringify({ok:true,data}),{headers:{"content-type":"application/json"}});
describe("business record workspace",()=>{
 const fetchMock=vi.fn<typeof fetch>();
 beforeEach(()=>{vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset().mockImplementation(async()=>response({records:[row],total:1}));});
 afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
 const supplier="10000000-0000-4000-8000-000000000002",order={...row,code:"PO-2026-000001",name:"Đơn mua xi măng",status:"draft",row_version:1,partner_id:supplier,order_date:"2026-11-03",expected_on:"2026-11-04",project_id:null,procurement_award_id:null};
 function createOrder(){render(<BusinessRecords workspace={{...w,features:["inventory","purchasing","crm"]}} kind="purchase_orders"/>);fireEvent.click(screen.getByRole("button",{name:"Tạo mới"}));const dialog=screen.getByRole("dialog");fireEvent.change(within(dialog).getByRole("textbox",{name:"Diễn giải"}),{target:{value:order.name}});fireEvent.change(within(dialog).getByRole("textbox",{name:/Nhà cung cấp/}),{target:{value:supplier}});fireEvent.change(within(dialog).getByLabelText(/Ngày dự kiến nhận/),{target:{value:"2099-11-04"}});fireEvent.click(within(dialog).getByRole("button",{name:"Lưu nháp & thêm dòng"}));return dialog;}
 it("keeps a new document open with the assigned number and its line editor",async()=>{let id="";fetchMock.mockImplementation(async(url,options)=>{if(options?.method==="POST"){id=JSON.parse(String(options.body)).recordId;return response({recordId:id,rowVersion:1});}return /\/records\/purchase_orders\/[^/?]+$/.test(String(url))?response({...order,id}):response({records:[],total:0});});createOrder();await screen.findByRole("region",{name:"Dòng hàng chứng từ"});expect(screen.getByRole("dialog")).toBeVisible();fireEvent.click(screen.getByRole("tab",{name:"Chứng từ"}));expect(screen.getByRole("textbox",{name:"Số chứng từ"})).toHaveValue(order.code);const post=fetchMock.mock.calls.find(([,options])=>options?.method==="POST")!;expect(JSON.parse(String(post[1]?.body))).toMatchObject({autoNumber:true,rowVersion:0,data:{code:"",name:order.name}});});
 it("recovers a confirmed save through a read instead of submitting a second document",async()=>{let reads=0,id="";fetchMock.mockImplementation(async(url,options)=>{if(options?.method==="POST"){id=JSON.parse(String(options.body)).recordId;return response({recordId:id,rowVersion:1});}if(/\/records\/purchase_orders\/[^/?]+$/.test(String(url))){reads++;return reads===1?new Response(JSON.stringify({ok:false,error:{message:"Chứng từ đã lưu. Tải lại chi tiết."}}),{status:503}):response({...order,id});}return response({records:[],total:0});});createOrder();fireEvent.click(await screen.findByRole("button",{name:"Tải lại chứng từ"}));await screen.findByRole("region",{name:"Dòng hàng chứng từ"});expect(fetchMock.mock.calls.filter(([,options])=>options?.method==="POST")).toHaveLength(1);fireEvent.click(screen.getByRole("tab",{name:"Chứng từ"}));expect(screen.getByRole("textbox",{name:"Diễn giải"})).toBeEnabled();});
 it("validates the new form locally and focuses the first invalid field",async()=>{
  render(<BusinessRecords workspace={w} kind="items"/>);await screen.findByRole("button",{name:"VT01 Thép hộp"});fireEvent.click(screen.getByRole("button",{name:"Tạo mới"}));const dialog=screen.getByRole("dialog");fireEvent.click(within(dialog).getByRole("button",{name:"Lưu"}));expect(await screen.findByText("Kiểm tra các trường được đánh dấu.")).toHaveAttribute("role","alert");const code=within(dialog).getByRole("textbox",{name:"Mã"});await waitFor(()=>expect(code).toHaveFocus());expect(code).toHaveAttribute("aria-invalid","true");expect(fetchMock.mock.calls.every(([,options])=>!options?.method||options.method==="GET")).toBe(true);
 });
 it("preserves record identity and version while saving from the drawer footer",async()=>{
  fetchMock.mockImplementation(async(_url,options)=>options?.method==="POST"?response({id:row.id}):response({records:[row],total:1}));
  render(<BusinessRecords workspace={w} kind="items"/>);fireEvent.click(await screen.findByRole("button",{name:"VT01 Thép hộp"}));const dialog=screen.getByRole("dialog");fireEvent.change(within(dialog).getByRole("textbox",{name:"Tên"}),{target:{value:"Thép hộp cập nhật"}});const save=within(dialog).getByRole("button",{name:"Lưu"});expect(save.closest("footer")).not.toBeNull();fireEvent.click(save);await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());const call=fetchMock.mock.calls.find(([,options])=>options?.method==="POST")!;expect(call[0]).toBe("/api/v1/business/acme/records/items");expect(JSON.parse(String(call[1]?.body))).toMatchObject({recordId:row.id,rowVersion:3,data:{code:"VT01",name:"Thép hộp cập nhật",unit:"kg"}});
 });
 it("lets viewers inspect records and choose columns without write actions",async()=>{
  render(<BusinessRecords workspace={{...w,role:"viewer"}} kind="items"/>);await screen.findByRole("button",{name:"VT01 Thép hộp"});expect(screen.queryByRole("button",{name:"Tạo mới"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Cột hiển thị"}));const columns=screen.getByRole("dialog");const choices=within(columns).getAllByRole("checkbox");fireEvent.click(choices[0]);fireEvent.click(within(columns).getByRole("button",{name:"Xong"}));fireEvent.click(screen.getByRole("button",{name:"VT01 Thép hộp"}));expect(within(screen.getByRole("dialog")).queryByRole("button",{name:"Lưu"})).toBeNull();expect(within(screen.getByRole("dialog")).queryByRole("textbox",{name:"Tên"})).toBeNull();expect(within(screen.getByRole("dialog")).getByText("kg")).toBeVisible();expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("keeps receiving inside an issued purchase order and prevents hiding an unfinished receipt",async()=>{
  const issued={...order,status:"released",references:{partner_id:"NCC01 · An Phú"}};
  fetchMock.mockResolvedValue(response({records:[issued],total:1}));
  render(<BusinessRecords workspace={{...w,features:["inventory","purchasing","crm"]}} kind="purchase_orders"/>);
  fireEvent.click(await screen.findByRole("button",{name:issued.code+" "+issued.name}));const dialog=screen.getByRole("dialog");
  expect(within(dialog).queryByRole("textbox",{name:"Diễn giải"})).toBeNull();expect(within(dialog).getByRole("region",{name:"Dòng hàng chứng từ"})).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button",{name:"Nhận hàng"}));const panel=within(dialog).getByRole("region",{name:"Nhận hàng tại đơn"});expect(panel).toHaveAttribute("data-order",issued.id);
  fireEvent.click(within(panel).getByRole("button",{name:"Nhập phiếu nhận"}));fireEvent.click(within(dialog).getByRole("tab",{name:"Lịch sử"}));
  expect(within(dialog).getByRole("tab",{name:"Nhận hàng & đối chiếu"})).toHaveAttribute("aria-selected","true");expect(within(dialog).getByRole("alert")).toHaveTextContent("Hoàn tất hoặc bỏ thay đổi");expect(document.querySelector('[data-business-unsaved="true"]')).not.toBeNull();
  expect(fetchMock.mock.calls.every(([,options])=>!options?.method||options.method==="GET")).toBe(true);
 });
 it("reads the authoritative header before accepting a newer version reported by a child list",async()=>{
  const supplierB="10000000-0000-4000-8000-000000000003",updated={...order,row_version:2,partner_id:supplierB};
  fetchMock.mockImplementation(async(url,options)=>options?.method==="POST"?response({recordId:order.id,rowVersion:3}):/\/records\/purchase_orders\/[^/?]+$/.test(String(url))?response(updated):response({records:[order],total:1}));
  render(<BusinessRecords workspace={{...w,features:["inventory","purchasing","crm"]}} kind="purchase_orders"/>);fireEvent.click(await screen.findByRole("button",{name:order.code+" "+order.name}));
  fireEvent.click(screen.getByRole("button",{name:"Đọc phiên bản cha mới"}));await waitFor(()=>expect(screen.getByRole("textbox",{name:/Nhà cung cấp/})).toHaveValue(supplierB));
  fireEvent.change(screen.getByRole("textbox",{name:"Diễn giải"}),{target:{value:"Thay diễn giải đã đọc mới"}});fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi"}));await waitFor(()=>expect(fetchMock.mock.calls.some(([,options])=>options?.method==="POST")).toBe(true));
  const command=JSON.parse(String(fetchMock.mock.calls.find(([,options])=>options?.method==="POST")![1]?.body));expect(command).toMatchObject({rowVersion:2,data:{partner_id:supplierB}});
 });
 it("preserves a dirty header and requires explicit discard before reloading a concurrent version",async()=>{
  fetchMock.mockImplementation(async url=>/\/records\/purchase_orders\/[^/?]+$/.test(String(url))?response({...order,row_version:2,name:"Đơn mua đã được cập nhật"}):response({records:[order],total:1}));
  render(<BusinessRecords workspace={{...w,features:["inventory","purchasing","crm"]}} kind="purchase_orders"/>);fireEvent.click(await screen.findByRole("button",{name:order.code+" "+order.name}));
  fireEvent.change(screen.getByRole("textbox",{name:"Diễn giải"}),{target:{value:"Phần đang nhập"}});fireEvent.click(screen.getByRole("button",{name:"Đọc phiên bản cha mới"}));expect(screen.getByRole("textbox",{name:"Diễn giải"})).toHaveValue("Phần đang nhập");expect(screen.queryByRole("button",{name:"Lưu thay đổi"})).toBeNull();
  const confirmation=vi.spyOn(window,"confirm").mockReturnValue(false);fireEvent.click(screen.getByRole("button",{name:"Tải lại chứng từ"}));expect(screen.getByRole("textbox",{name:"Diễn giải"})).toHaveValue("Phần đang nhập");expect(fetchMock.mock.calls.filter(([url])=>/\/records\/purchase_orders\/[^/?]+$/.test(String(url)))).toHaveLength(0);
  confirmation.mockReturnValue(true);fireEvent.click(screen.getByRole("button",{name:"Tải lại chứng từ"}));await waitFor(()=>expect(screen.getByRole("textbox",{name:"Diễn giải"})).toHaveValue("Đơn mua đã được cập nhật"));expect(fetchMock.mock.calls.every(([,options])=>!options?.method||options.method==="GET")).toBe(true);
 });
});
