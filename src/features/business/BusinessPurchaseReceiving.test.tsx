import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {BusinessPurchaseReceiving} from "./BusinessPurchaseReceiving";
import type {BusinessWorkspace} from "./businessSchemas";
import {businessToday} from "./businessRecordDefaults";

const policy=vi.hoisted(()=>({required:false,status:"not_submitted",stale:false,version:undefined as number|undefined}));
vi.mock("./BusinessReference",()=>({BusinessReference:({label,value,onChange,disabled}:{label:string;value:string|null;onChange:(value:string)=>void;disabled:boolean})=><label>{label}<input aria-label={label} value={value??""} disabled={disabled} onChange={event=>onChange(event.target.value)}/></label>}));
vi.mock("./BusinessApprovalPanel",()=>({BusinessApprovalPanel:({version,onContext}:{version:number;onContext:(context:unknown)=>void})=><button type="button" onClick={()=>onContext({documentVersion:policy.version??version,required:policy.required,status:policy.status,stale:policy.stale,actions:[]})}>Nhận trạng thái duyệt</button>}));

const orderId="10000000-0000-4000-8000-000000000001",itemId="10000000-0000-4000-8000-000000000002",warehouseId="10000000-0000-4000-8000-000000000003",secondItemId="10000000-0000-4000-8000-000000000004";
const w={tenantId:"tenant",slug:"acme",industry:"construction",features:["inventory","purchasing","crm"],role:"owner",accountId:"owner"} as BusinessWorkspace;
const order={id:orderId,code:"PO-2026-000123",status:"released",row_version:9,order_date:businessToday()};
const line={id:"20000000-0000-4000-8000-000000000001",item_id:itemId,name:"Xi măng",quantity:24,unit_price:20000,references:{item_id:"VT-01 · Xi măng"}};
const secondLine={...line,id:"20000000-0000-4000-8000-000000000002",item_id:secondItemId,name:"Tấm lợp",unit_price:50000,references:{item_id:"VT-02 · Tấm lợp"}};
const response=(data:unknown)=>new Response(JSON.stringify({ok:true,data}),{headers:{"content-type":"application/json"}});
const failed=(message:string,status=503)=>new Response(JSON.stringify({ok:false,error:{message}}),{status,headers:{"content-type":"application/json"}});

describe("purchase receiving inside the order",()=>{
 const fetchMock=vi.fn<typeof fetch>(),onPending=vi.fn(),onBusy=vi.fn(),onCommitted=vi.fn();
 let savedId="",receiptReads=0,posted=false;
 function defaultFetch(url:RequestInfo|URL,options?:RequestInit):Promise<Response>{
  const path=String(url);
  if(options?.method==="POST"){
   const command=JSON.parse(String(options.body));
   if(path.endsWith("/records/purchase_receipts")){savedId=command.recordId;return Promise.resolve(response({recordId:savedId,rowVersion:1}));}
   if(path.endsWith("/actions")){posted=true;return Promise.resolve(response({recordId:savedId,rowVersion:8}));}
  }
  if(path.includes("/document-lines/"))return Promise.resolve(response({rows:[line],total:1,page:1,pageSize:25,parentVersion:9,parentReviewedBy:null}));
  if(path.includes("/procurement?"))return Promise.resolve(response({accountingEnabled:false,totals:{count:1},rows:[{id:orderId,ordered:480000,received_agreed:240000,received_actual:240000,invoiced:null,payable:null}]}));
  if(path.includes("/records/items/"))return Promise.resolve(response({id:path.endsWith(secondItemId)?secondItemId:itemId,unit:path.endsWith(secondItemId)?"cái":"kg",tracking:"none"}));
  if(path.includes("/records/purchase_receipts/")){receiptReads++;return Promise.resolve(response({id:savedId,code:"PR-2026-000001",status:posted?"posted":"draft",row_version:posted?8:7,purchase_order_id:orderId,item_id:itemId,quantity:2,unit_cost:20000,references:{item_id:"VT-01 · Xi măng",warehouse_id:"K01 · Kho chính"}}));}
  return Promise.reject(Error("Unexpected test request: "+path));
 }
 beforeEach(()=>{savedId="";receiptReads=0;posted=false;policy.required=false;policy.status="not_submitted";policy.stale=false;policy.version=undefined;fetchMock.mockReset().mockImplementation(defaultFetch);onPending.mockReset();onBusy.mockReset();onCommitted.mockReset();vi.stubGlobal("fetch",fetchMock);});
 afterEach(()=>vi.unstubAllGlobals());
 function mount(workspace=w,orderValue=order){return render(<BusinessPurchaseReceiving workspace={workspace} order={orderValue} disabled={false} onPendingChange={onPending} onBusyChange={onBusy} onCommitted={onCommitted}/>);}
 async function choose(label:string){fireEvent.click(await screen.findByRole("combobox",{name:"Vật tư nhận"}));fireEvent.click(await screen.findByRole("option",{name:label}));}
 async function fill(){await screen.findAllByText("VT-01 · Xi măng");await choose("VT-01 · Xi măng");await waitFor(()=>expect(screen.getByRole("textbox",{name:"Đơn vị cơ sở"})).toHaveValue("kg"));fireEvent.change(screen.getByRole("spinbutton",{name:"Số lượng nhận"}),{target:{value:"2"}});fireEvent.change(screen.getByRole("textbox",{name:"Kho nhận"}),{target:{value:warehouseId}});}
 const posts=()=>fetchMock.mock.calls.filter(([,options])=>options?.method==="POST");

 it("saves a single item in base units using the legacy command and retains the order",async()=>{
  mount();await fill();expect(screen.getByRole("spinbutton",{name:"Đơn giá nhận"})).toHaveValue(20000);fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));
  await screen.findByText("PR-2026-000001");const command=JSON.parse(String(posts()[0][1]?.body));expect(command).toMatchObject({rowVersion:0,autoNumber:true,data:{purchase_order_id:orderId,item_id:itemId,quantity:2,unit_cost:20000,warehouse_id:warehouseId,code:"",name:"Nhận hàng · "+order.code}});
  expect(Object.keys(command.data).sort()).toEqual(["code","name","notes","purchase_order_id","item_id","warehouse_id","lot_id","quantity","unit_cost","document_date"].sort());expect(command.recordId).toMatch(/^[a-f0-9-]{36}$/);expect(onCommitted).toHaveBeenCalledTimes(1);await waitFor(()=>expect(onPending).toHaveBeenLastCalledWith(false));expect(onBusy.mock.calls.map(([value])=>value)).toEqual([true,false]);
 });
 it("retries an uncertain save with the exact same UUID and body",async()=>{
  let creates=0;fetchMock.mockImplementation((url,options)=>{if(options?.method==="POST"&&String(url).endsWith("/records/purchase_receipts")&&++creates===1)return Promise.reject(Error("Mất phản hồi lưu"));return defaultFetch(url,options);});
  mount();await fill();fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));fireEvent.click(await screen.findByRole("button",{name:"Thử lại cùng yêu cầu"}));await screen.findByText("PR-2026-000001");
  expect(posts()).toHaveLength(2);expect(posts()[0][1]?.body).toBe(posts()[1][1]?.body);expect(posts()[0][0]).toBe(posts()[1][0]);
 });
 it("uses GET-only recovery after a confirmed save whose detail read failed",async()=>{
  let detailCalls=0;fetchMock.mockImplementation((url,options)=>{if(!options?.method&&String(url).includes("/records/purchase_receipts/")&&++detailCalls===1)return Promise.resolve(failed("Phiếu đã lưu, chưa đọc được"));return defaultFetch(url,options);});
  mount();await fill();fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));fireEvent.click(await screen.findByRole("button",{name:"Tải lại phiếu nhận"}));await screen.findByText("PR-2026-000001");
  expect(posts()).toHaveLength(1);expect(detailCalls).toBe(2);expect(screen.queryByRole("button",{name:"Thử lại cùng yêu cầu"})).toBeNull();
 });
 it("requires the actual receipt version and approved current context before posting",async()=>{
  mount();await fill();fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));await screen.findByText("PR-2026-000001");expect(screen.queryByRole("button",{name:"Nhận vào kho"})).toBeNull();
  policy.version=6;fireEvent.click(screen.getByRole("button",{name:"Nhận trạng thái duyệt"}));expect(screen.queryByRole("button",{name:"Nhận vào kho"})).toBeNull();
  policy.version=7;policy.required=true;policy.status="pending";fireEvent.click(screen.getByRole("button",{name:"Nhận trạng thái duyệt"}));expect(screen.queryByRole("button",{name:"Nhận vào kho"})).toBeNull();
  policy.status="approved";policy.stale=true;fireEvent.click(screen.getByRole("button",{name:"Nhận trạng thái duyệt"}));expect(screen.queryByRole("button",{name:"Nhận vào kho"})).toBeNull();
  policy.stale=false;fireEvent.click(screen.getByRole("button",{name:"Nhận trạng thái duyệt"}));fireEvent.click(screen.getByRole("button",{name:"Nhận vào kho"}));await screen.findByText("Đã nhận vào kho");
  const command=JSON.parse(String(posts()[1][1]?.body));expect(command).toMatchObject({rowVersion:7,action:"post"});expect(posts()[1][0]).toBe(`/api/v1/business/acme/records/purchase_receipts/${savedId}/actions`);expect(posts()).toHaveLength(2);expect(receiptReads).toBe(2);
 });
 it("keeps the backend authoritative when a partial receipt exceeds the remaining quantity",async()=>{
  fetchMock.mockImplementation((url,options)=>options?.method==="POST"&&String(url).endsWith("/actions")?Promise.resolve(failed("Số lượng nhận vượt phần còn lại của đơn mua.",400)):defaultFetch(url,options));
  mount();await fill();fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));await screen.findByText("PR-2026-000001");fireEvent.click(screen.getByRole("button",{name:"Nhận trạng thái duyệt"}));fireEvent.click(screen.getByRole("button",{name:"Nhận vào kho"}));await screen.findByText("Số lượng nhận vượt phần còn lại của đơn mua.");
  expect(screen.getByRole("button",{name:"Tải lại phiếu nhận"})).toBeVisible();expect(screen.queryByText("Đã nhận vào kho")).toBeNull();expect(posts()).toHaveLength(2);
 });
 it("ignores a delayed unit response for the previously selected item",async()=>{
  let resolveFirst:(value:Response)=>void=()=>{};const first=new Promise<Response>(resolve=>{resolveFirst=resolve;});
  fetchMock.mockImplementation((url,options)=>{if(String(url).includes("/document-lines/"))return Promise.resolve(response({rows:[line,secondLine],total:2,parentVersion:9}));if(String(url).endsWith("/records/items/"+itemId))return first;return defaultFetch(url,options);});
  mount();await screen.findAllByText("VT-02 · Tấm lợp");await choose("VT-01 · Xi măng");await choose("VT-02 · Tấm lợp");await waitFor(()=>expect(screen.getByRole("textbox",{name:"Đơn vị cơ sở"})).toHaveValue("cái"));
  await act(async()=>resolveFirst(response({id:itemId,unit:"kg",tracking:"none"})));expect(screen.getByRole("textbox",{name:"Đơn vị cơ sở"})).toHaveValue("cái");expect(screen.getByRole("spinbutton",{name:"Số lượng nhận"})).toHaveValue(null);expect(screen.getByRole("spinbutton",{name:"Đơn giá nhận"})).toHaveValue(50000);
 });
 it("corrects a saved draft inside the order with the original receipt ID and current CAS",async()=>{
  mount();await fill();fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));await screen.findByText("PR-2026-000001");const original=JSON.parse(String(posts()[0][1]?.body)).recordId;
  fireEvent.click(screen.getByRole("button",{name:"Sửa phiếu nhận"}));fireEvent.change(screen.getByRole("spinbutton",{name:"Số lượng nhận"}),{target:{value:"1"}});fireEvent.change(screen.getByRole("textbox",{name:"Kho nhận"}),{target:{value:warehouseId}});await waitFor(()=>expect(screen.getByRole("button",{name:"Lưu thay đổi phiếu nhận"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi phiếu nhận"}));await screen.findByText("PR-2026-000001");
  const command=JSON.parse(String(posts()[1][1]?.body));expect(command).toMatchObject({recordId:original,rowVersion:7,data:{code:"PR-2026-000001",quantity:1}});expect(command.autoNumber).toBeUndefined();expect(posts()).toHaveLength(2);
 });
 it("shows no money metrics when the exact order ID is missing",async()=>{
  fetchMock.mockImplementation((url,options)=>String(url).includes("/procurement?")?Promise.resolve(response({rows:[{id:"different",ordered:0,received_agreed:0,received_actual:0}],totals:{count:1}})):defaultFetch(url,options));
  mount();await screen.findByText("Chưa có số liệu đối chiếu cho đơn mua này.");expect(screen.queryByText("Giá trị đặt mua")).toBeNull();expect(screen.queryByText("Giá trị nhận thực tế")).toBeNull();
 });
 it("does not request aggregate reports for scoped users",async()=>{
  const scoped={...w,role:"editor",customAccess:true,grants:[{kind:"purchase_lines",actions:["read"],scope:"tenant"},{kind:"items",actions:["read"],scope:"tenant"},{kind:"warehouses",actions:["read"],scope:"tenant"},{kind:"purchase_receipts",actions:["read","create","post"],scope:"tenant"}]} as BusinessWorkspace;
  mount(scoped);await screen.findAllByText("VT-01 · Xi măng");expect(fetchMock.mock.calls.some(([url])=>String(url).includes("/procurement?"))).toBe(false);expect(screen.getByText("Đối chiếu tổng hợp không khả dụng với quyền hiện tại.")).toBeVisible();
 });
 it.each([{role:"viewer",status:"released",label:"Chỉ xem nhận hàng"},{role:"owner",status:"draft",label:"Đơn mua chưa phát hành"},{role:"owner",status:"completed",label:"Đơn mua đã hoàn thành"}])("keeps $role/$status read-only",async({role,status,label})=>{
  mount({...w,role} as BusinessWorkspace,{...order,status});await screen.findAllByText("VT-01 · Xi măng");expect(screen.queryByRole("form",{name:"Nhận một mặt hàng"})).toBeNull();expect(screen.getAllByText(label).length).toBeGreaterThan(0);expect(posts()).toHaveLength(0);
 });
 it("fails explicitly rather than using a partial list over 1,000 lines",async()=>{
  fetchMock.mockImplementation((url,options)=>String(url).includes("/document-lines/")?Promise.resolve(response({rows:[line],total:1001,parentVersion:9})):defaultFetch(url,options));
  mount();await screen.findByText("Đơn mua vượt giới hạn 1.000 dòng của màn hình nhận hàng.");expect(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"})).toBeDisabled();expect(posts()).toHaveLength(0);
 });
 it("loads every allowed page before offering deduplicated item choices",async()=>{
  const firstPage=Array.from({length:25},(_,index)=>({...line,id:`line-${index}`}));
  fetchMock.mockImplementation((url,options)=>String(url).includes("/document-lines/")?Promise.resolve(response({rows:String(url).includes("page=2")?[secondLine]:firstPage,total:26,parentVersion:9})):defaultFetch(url,options));
  mount();await screen.findAllByText("VT-02 · Tấm lợp");expect(fetchMock.mock.calls.filter(([url])=>String(url).includes("/document-lines/"))).toHaveLength(2);fireEvent.click(screen.getByRole("combobox",{name:"Vật tư nhận"}));expect(screen.getAllByRole("option",{name:/^VT-/})).toHaveLength(2);
 });
 it("rejects fractional base quantities for serial-tracked items before saving",async()=>{
  fetchMock.mockImplementation((url,options)=>String(url).includes("/records/items/")?Promise.resolve(response({id:itemId,unit:"kg",tracking:"serial"})):defaultFetch(url,options));
  mount();await fill();fireEvent.change(screen.getByRole("spinbutton",{name:"Số lượng nhận"}),{target:{value:"1.5"}});fireEvent.change(screen.getByRole("textbox",{name:"Lô hàng"}),{target:{value:"10000000-0000-4000-8000-000000000009"}});fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));
  await screen.findByText("Số lượng theo số sê-ri phải là số nguyên.");expect(posts()).toHaveLength(0);
 });
 it("ends an old command's busy signal on unmount without later overriding a new order session",async()=>{
  let finishPost:(value:Response)=>void=()=>{};const post=new Promise<Response>(resolve=>{finishPost=resolve;});fetchMock.mockImplementation((url,options)=>options?.method==="POST"?post:defaultFetch(url,options));
  const view=mount();await fill();fireEvent.click(screen.getByRole("button",{name:"Lưu phiếu nhận nháp"}));expect(onBusy).toHaveBeenLastCalledWith(true);
  view.rerender(<BusinessPurchaseReceiving workspace={w} order={{...order,id:secondItemId}} disabled={false} onPendingChange={onPending} onBusyChange={onBusy} onCommitted={onCommitted}/>);expect(onBusy).toHaveBeenLastCalledWith(false);const calls=onBusy.mock.calls.length;
  await act(async()=>finishPost(response({recordId:JSON.parse(String(posts()[0][1]?.body)).recordId,rowVersion:1})));expect(onBusy).toHaveBeenCalledTimes(calls);expect(onCommitted).not.toHaveBeenCalled();expect(screen.queryByText("PR-2026-000001")).toBeNull();
 });
 it("clears the parent pending flag when its dirty session unmounts",async()=>{
  const view=mount();await fill();await waitFor(()=>expect(onPending).toHaveBeenLastCalledWith(true));view.unmount();expect(onPending).toHaveBeenLastCalledWith(false);
 });
});
