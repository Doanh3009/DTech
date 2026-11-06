import type {ComponentProps} from "react";
import {act,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {BusinessDocumentLines} from "./BusinessDocumentLines";
import type {BusinessWorkspace} from "./businessSchemas";

vi.mock("./BusinessReference",()=>({BusinessReference:({id,label,value,onChange,onSelect,disabled,validationError}:{id:string;label:string;value:string|null;onChange:(value:string|null)=>void;onSelect?:(option:{id:string;code:string;name:string})=>void;disabled:boolean;validationError?:string})=><label htmlFor={id}>{label}<input id={id} value={value??""} disabled={disabled} aria-invalid={!!validationError} onChange={event=>{onChange(event.target.value||null);if(event.target.value)onSelect?.({id:event.target.value,code:"VT01",name:"Bu lông"});}}/>{validationError?<span>{validationError}</span>:null}</label>}));

const parentId="11111111-1111-4111-8111-111111111111",itemId="22222222-2222-4222-8222-222222222222",lineId="33333333-3333-4333-8333-333333333333",today="2026-11-05";
const workspace={slug:"acme",industry:"construction",role:"owner",features:["purchasing","inventory","crm","sales"]} as BusinessWorkspace;
const firstRow={id:lineId,code:"CT01",name:"Bu lông",notes:"",row_version:2,status:"active",purchase_order_id:parentId,item_id:itemId,quantity:24,unit_price:1000,entry_quantity:2,entry_unit:"thùng",entry_price:12000,base_unit:"cái",unit_factor:12,unit_effective_on:today,references:{item_id:"VT01 · Bu lông"}};
type Row=typeof firstRow;
type RequestBody={recordId?:string;rowVersion:number;requestId:string;data?:Record<string,unknown>;action?:string};
const response=(data:unknown,ok=true,status=ok?200:400)=>({ok,status,json:async()=>ok?{ok:true,data}:{ok:false,error:{message:String(data)}}});
let fetchMock:ReturnType<typeof vi.fn>,rows:Row[],serverVersion:number,total:number|undefined,posts:{url:string;body:string}[],write:(url:string,body:RequestBody)=>Promise<ReturnType<typeof response>>;
function applyWrite(url:string,body:RequestBody){
 serverVersion++;
 if(url.endsWith("/actions")){const id=url.split("/").at(-2)!;rows=rows.filter(row=>row.id!==id);return {recordId:id,rowVersion:body.rowVersion+1};}
 const values=body.data!,factor=values.entry_unit==="thùng"?12:1,quantity=Number(values.entry_quantity??values.quantity),price=Number(values.entry_price??values.unit_price);
 const row={...firstRow,...values,id:body.recordId!,name:String(values.name),row_version:body.rowVersion+1,quantity:quantity*factor,unit_price:price/factor,entry_quantity:quantity,entry_price:price,entry_unit:String(values.entry_unit??"cái"),unit_factor:factor};
 rows=[...rows.filter(current=>current.id!==row.id),row];return {recordId:row.id,rowVersion:row.row_version};
}
beforeEach(()=>{
 rows=[{...firstRow}];serverVersion=2;total=undefined;posts=[];write=async(url,body)=>response(applyWrite(url,body));
 fetchMock=vi.fn(async(url:string,options?:RequestInit)=>{
  if(options?.method==="POST"){posts.push({url,body:String(options.body)});return write(url,JSON.parse(String(options.body)));}
  if(url.includes("/document-lines/"))return response({rows,total:total??rows.length,parentVersion:serverVersion,parentReviewedBy:null});
  if(url.includes("/records/purchase_orders/"))return response({order_date:today});
  if(url.includes("/items/")&&url.includes("/units?"))return response({baseUnit:"cái",effectiveOn:today,options:[{unit:"cái",factor:1},{unit:"thùng",factor:12}]});
  throw Error("Unexpected test route");
 });
 vi.stubGlobal("fetch",fetchMock);vi.spyOn(window,"confirm").mockReturnValue(true);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const props=(changes:Partial<ComponentProps<typeof BusinessDocumentLines>>={})=>({workspace,parentKind:"purchase_orders" as const,parentId,parentVersion:2,editable:true,disabled:false,onBusyChange:vi.fn(),onPendingChange:vi.fn(),onParentUpdated:vi.fn(),...changes});
async function loaded(){await screen.findByText("VT01 · Bu lông");}
async function openNew(){fireEvent.click(screen.getByRole("button",{name:"Thêm dòng"}));await screen.findByRole("region",{name:"Thêm dòng chứng từ"});}
async function fillNew(){
 fireEvent.change(screen.getByLabelText("Diễn giải",{exact:false}),{target:{value:"Bu lông"}});
 fireEvent.change(screen.getByLabelText("Vật tư / hàng hóa",{exact:false}),{target:{value:itemId}});
 await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());
 fireEvent.click(screen.getByRole("combobox",{name:"Đơn vị nhập"}));fireEvent.click(await screen.findByRole("option",{name:"thùng"}));
 fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"2"}});
 fireEvent.change(screen.getByLabelText("Đơn giá theo đơn vị nhập",{exact:false}),{target:{value:"12000"}});
}

describe("document line workbench",()=>{
 it("starts with the saved line grid, paired entry/base units and real money totals instead of an open form",async()=>{
  render(<BusinessDocumentLines {...props()}/>);await loaded();
  expect(screen.queryByRole("region",{name:"Thêm dòng chứng từ"})).not.toBeInTheDocument();
  expect(screen.getByText("2 thùng")).toBeInTheDocument();expect(screen.getByText("24 cái")).toBeInTheDocument();
  expect(within(screen.getByRole("group",{name:"Tổng hợp chi tiết"})).getByText("24.000")).toBeInTheDocument();expect(posts).toHaveLength(0);
 });

 it("opens the embedded editor after a confirmed new parent when startAdding is requested",async()=>{
  rows=[];render(<BusinessDocumentLines {...props({startAdding:true})}/>);
  expect(await screen.findByRole("region",{name:"Thêm dòng chứng từ"})).toBeInTheDocument();expect(screen.getByLabelText("Diễn giải",{exact:false})).toHaveFocus();expect(posts).toHaveLength(0);
 });

 it("focuses automatic line entry after the parent finishes its confirmed-save reload",async()=>{
  rows=[];const view=render(<BusinessDocumentLines {...props({startAdding:true,disabled:true})}/>);
  const description=await screen.findByLabelText("Diễn giải",{exact:false});expect(description).toBeDisabled();expect(description).not.toHaveFocus();
  view.rerender(<BusinessDocumentLines {...props({startAdding:true,disabled:false})}/>);
  await waitFor(()=>expect(description).toHaveFocus());expect(description).toBeEnabled();expect(posts).toHaveLength(0);
 });

 it("does not move focus back to the description after an already opened editor is unlocked",async()=>{
  rows=[];const view=render(<BusinessDocumentLines {...props({startAdding:true})}/>);
  const description=await screen.findByLabelText("Diễn giải",{exact:false}),item=screen.getByLabelText("Vật tư / hàng hóa",{exact:false});
  item.focus();expect(item).toHaveFocus();
  view.rerender(<BusinessDocumentLines {...props({startAdding:true,disabled:true})}/>);
  view.rerender(<BusinessDocumentLines {...props({startAdding:true,disabled:false})}/>);
  expect(description).not.toHaveFocus();expect(posts).toHaveLength(0);
 });

 it("validates inline and focuses the first invalid field without posting",async()=>{
  render(<BusinessDocumentLines {...props()}/>);await loaded();await openNew();
  fireEvent.change(screen.getByLabelText("Diễn giải",{exact:false}),{target:{value:"A"}});fireEvent.click(screen.getByRole("button",{name:"Thêm vào chứng từ"}));
  expect(await screen.findByText("Nhập diễn giải từ 2 ký tự.")).toBeInTheDocument();await waitFor(()=>expect(screen.getByLabelText("Diễn giải",{exact:false})).toHaveFocus());expect(posts).toHaveLength(0);
 });

 it("saves entered units in the same document, closes the editor only after receipt and updates parent version",async()=>{
  rows=[];const updated=vi.fn(),pending=vi.fn();render(<BusinessDocumentLines {...props({onParentUpdated:updated,onPendingChange:pending})}/>);
  await screen.findByText("Chưa có dòng chi tiết");await openNew();await fillNew();fireEvent.click(screen.getByRole("button",{name:"Thêm vào chứng từ"}));
  await screen.findByText("Đã thêm dòng");await loaded();expect(screen.queryByRole("region",{name:"Thêm dòng chứng từ"})).not.toBeInTheDocument();
  const body=JSON.parse(posts[0].body);expect(body.rowVersion).toBe(0);expect(body.data).toMatchObject({quantity:2,unit_price:12000,entry_quantity:2,entry_unit:"thùng",entry_price:12000,purchase_order_id:parentId});expect(updated).toHaveBeenLastCalledWith(3,null,"write");expect(pending).toHaveBeenLastCalledWith(false);
 });

 it("edits entry quantities rather than canonical quantities and preserves compare-and-swap",async()=>{
  render(<BusinessDocumentLines {...props()}/>);await loaded();fireEvent.click(screen.getByRole("button",{name:"Sửa"}));
  expect(await screen.findByRole("region",{name:"Sửa dòng chứng từ"})).toBeInTheDocument();expect(screen.getByLabelText("Số lượng nhập",{exact:false})).toHaveValue(2);
  await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"3"}});fireEvent.click(screen.getByRole("button",{name:"Lưu dòng"}));
  await screen.findByText("Đã cập nhật dòng");expect(JSON.parse(posts[0].body)).toMatchObject({recordId:lineId,rowVersion:2,data:{entry_quantity:3,entry_unit:"thùng"}});expect(rows[0].quantity).toBe(36);
 });

 it("retries a lost response with exactly the same request UUID and payload while keeping the editor locked",async()=>{
  let lost=true;write=async(url,body)=>{if(lost){lost=false;throw new TypeError("Mất kết nối");}return response(applyWrite(url,body));};
  render(<BusinessDocumentLines {...props()}/>);await loaded();fireEvent.click(screen.getByRole("button",{name:"Sửa"}));await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"3"}});fireEvent.click(screen.getByRole("button",{name:"Lưu dòng"}));
  const retry=await screen.findByRole("button",{name:"Thử lại cùng yêu cầu"});expect(screen.getByLabelText("Số lượng nhập",{exact:false})).toBeDisabled();expect(screen.getByRole("button",{name:"Hủy sửa"})).toBeDisabled();fireEvent.click(retry);
  await screen.findByText("Đã cập nhật dòng");expect(posts).toHaveLength(2);expect(posts[1].body).toBe(posts[0].body);
 });

 it("keeps an unconfirmed HTTP 200 result pending instead of treating it as a committed line",async()=>{
  let incomplete=true;write=async(url,body)=>incomplete?(incomplete=false,response({recordId:body.recordId,rowVersion:body.rowVersion})):response(applyWrite(url,body));
  render(<BusinessDocumentLines {...props()}/>);await loaded();fireEvent.click(screen.getByRole("button",{name:"Sửa"}));await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"3"}});fireEvent.click(screen.getByRole("button",{name:"Lưu dòng"}));
  fireEvent.click(await screen.findByRole("button",{name:"Thử lại cùng yêu cầu"}));await screen.findByText("Đã cập nhật dòng");expect(posts[0].body).toBe(posts[1].body);
 });

 it("retains dirty input when discard is declined and clears the parent's dirty flag only after confirmation",async()=>{
  const pending=vi.fn();render(<BusinessDocumentLines {...props({onPendingChange:pending})}/>);await loaded();await openNew();fireEvent.change(screen.getByLabelText("Diễn giải",{exact:false}),{target:{value:"Dòng chưa lưu"}});
  vi.mocked(window.confirm).mockReturnValue(false);fireEvent.click(screen.getByRole("button",{name:"Hủy nhập"}));expect(screen.getByLabelText("Diễn giải",{exact:false})).toHaveValue("Dòng chưa lưu");expect(pending).toHaveBeenLastCalledWith(true);
  vi.mocked(window.confirm).mockReturnValue(true);fireEvent.click(screen.getByRole("button",{name:"Hủy nhập"}));expect(screen.queryByRole("region",{name:"Thêm dòng chứng từ"})).not.toBeInTheDocument();expect(pending).toHaveBeenLastCalledWith(false);expect(posts).toHaveLength(0);
 });

 it("keeps locked parent lines read-only even when automatic entry was requested",async()=>{
  render(<BusinessDocumentLines {...props({editable:false,startAdding:true})}/>);await loaded();
  expect(screen.getByText("Chỉ xem")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Thêm dòng"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Sửa"})).not.toBeInTheDocument();expect(screen.queryByRole("region",{name:"Thêm dòng chứng từ"})).not.toBeInTheDocument();expect(posts).toHaveLength(0);
 });

 it("requires the child's write permission even if the parent passed an editable flag",async()=>{
  render(<BusinessDocumentLines {...props({workspace:{...workspace,role:"viewer"},startAdding:true})}/>);await loaded();
  expect(screen.getByText("Chỉ xem")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Thêm dòng"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Sửa"})).not.toBeInTheDocument();expect(posts).toHaveLength(0);
 });

 it("labels paginated monetary values as page totals instead of claiming a document-wide amount",async()=>{
  total=30;render(<BusinessDocumentLines {...props()}/>);await loaded();expect(screen.getByText("Tiền hàng trang này")).toBeInTheDocument();expect(screen.queryByText("Tiền hàng",{exact:true})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Sau"})).toBeEnabled();
 });

 it("deduplicates a rapid double submit before React can render a disabled action",async()=>{
  let resolve!:(value:ReturnType<typeof response>)=>void;write=()=>new Promise(done=>{resolve=done;});
  render(<BusinessDocumentLines {...props()}/>);await loaded();fireEvent.click(screen.getByRole("button",{name:"Sửa"}));await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"3"}});
  const form=screen.getByRole("button",{name:"Lưu dòng"}).getAttribute("form")!;
  act(()=>{fireEvent.submit(document.getElementById(form)!);fireEvent.submit(document.getElementById(form)!);});expect(posts).toHaveLength(1);
  await act(async()=>{resolve(response({recordId:lineId,rowVersion:3}));});await screen.findByText("Đã cập nhật dòng");
 });
});
