import {useState,type ComponentProps} from "react";
import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {BusinessTransactionQuantity} from "./BusinessTransactionQuantity";

type Props=ComponentProps<typeof BusinessTransactionQuantity>;
const itemA="11111111-1111-4111-8111-111111111111",itemB="22222222-2222-4222-8222-222222222222",order="33333333-3333-4333-8333-333333333333";
const today="2026-11-05";
const base={item_id:itemA,document_date:today,quantity:2,unit_cost:120,entry_unit:null,entry_quantity:null,entry_price:null};
const snapshot={...base,status:"draft",entry_unit:"thùng",entry_quantity:2,entry_price:120,quantity:24,unit_cost:10,base_unit:"cái",unit_factor:12,unit_effective_on:today};
const response=(data:unknown,ok=true)=>({ok,status:ok?200:400,json:async()=>ok?{ok:true,data}:{ok:false,error:{message:String(data)}}});
const units=(factor=12,on=today,baseUnit="cái")=>({baseUnit,effectiveOn:on,options:[{unit:baseUnit,factor:1},{unit:"thùng",factor}]});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
let fetchMock:ReturnType<typeof vi.fn>;
beforeEach(()=>{fetchMock=vi.fn(()=>Promise.resolve(response(units())));vi.stubGlobal("fetch",fetchMock);});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const props=(changes:Partial<Props>={}):Props=>({slug:"acme",kind:"stock_moves",recordId:"test-quantity",data:base,selected:null,disabled:false,onChange:vi.fn(),...changes});
function Stateful({initial=base,selected=null,onChange=vi.fn()}:{initial?:Record<string,unknown>;selected?:Record<string,unknown>|null;onChange?:(key:string,value:unknown)=>void}){
 const [data,setData]=useState<Record<string,unknown>>(initial);
 return <BusinessTransactionQuantity {...props({data,selected,onChange:(key,value)=>{onChange(key,value);setData(current=>({...current,[key]:value}));}})}/>;
}
async function chooseUnit(unit:string){fireEvent.click(screen.getByRole("combobox",{name:"Đơn vị nhập"}));fireEvent.click(await screen.findByRole("option",{name:unit}));}

describe("embedded transaction quantities",()=>{
 it("loads the base choice without dirtying a new document and mirrors entry quantity/price for validation",async()=>{
  const changed=vi.fn();render(<Stateful onChange={changed}/>);
  await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());
  expect(changed).not.toHaveBeenCalled();expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("2 cái");
  await chooseUnit("thùng");
  expect(changed).toHaveBeenCalledWith("entry_unit","thùng");expect(changed).toHaveBeenCalledWith("quantity",2);expect(changed).toHaveBeenCalledWith("unit_cost",120);
  expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("24 cái");expect(screen.getByLabelText("Đơn giá cơ sở")).toHaveValue("10");
  fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"3"}});
  fireEvent.change(screen.getByLabelText("Đơn giá theo đơn vị nhập",{exact:false}),{target:{value:"240"}});
  expect(changed).toHaveBeenCalledWith("entry_quantity",3);expect(changed).toHaveBeenCalledWith("quantity",3);expect(changed).toHaveBeenCalledWith("entry_price",240);expect(changed).toHaveBeenCalledWith("unit_cost",240);
  expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("36 cái");expect(screen.getByLabelText("Đơn giá cơ sở")).toHaveValue("20");
  fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:""}});expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("—");
 });

 it("retains a saved conversion when the catalog factor changes and recalculates only entered quantities",async()=>{
  fetchMock.mockResolvedValue(response(units(24)));const changed=vi.fn();render(<Stateful initial={snapshot} selected={snapshot} onChange={changed}/>);
  await waitFor(()=>expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeEnabled());
  expect(changed).not.toHaveBeenCalled();expect(screen.getByLabelText("Hệ số quy đổi")).toHaveValue("12");expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("24 cái");
  fireEvent.change(screen.getByLabelText("Số lượng nhập",{exact:false}),{target:{value:"3"}});
  expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("36 cái");expect(screen.getByLabelText("Đơn giá cơ sở")).toHaveValue("10");
 });

 it("uses the new effective date instead of a saved factor when the draft date changes",async()=>{
  const next="2026-11-06";fetchMock.mockResolvedValue(response(units(24,next)));
  render(<BusinessTransactionQuantity {...props({data:{...snapshot,document_date:next},selected:snapshot})}/>);
  await waitFor(()=>expect(screen.getByLabelText("Hệ số quy đổi")).toHaveValue("24"));
  expect(fetchMock.mock.calls[0][0]).toContain("on=2026-11-06");expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("48 cái");
 });

 it("reads the order date before line choices and shares one abort signal across both requests",async()=>{
  const next="2026-11-06";
  fetchMock.mockResolvedValueOnce(response({order_date:next})).mockResolvedValueOnce(response(units(24,next)));
  const row={...snapshot,status:"active",purchase_order_id:order,unit_price:10};
  render(<BusinessTransactionQuantity {...props({kind:"purchase_lines",data:row,selected:row})}/>);
  await waitFor(()=>expect(screen.getByLabelText("Hệ số quy đổi")).toHaveValue("24"));
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/business/acme/records/purchase_orders/${order}`);
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/business/acme/items/${itemA}/units?on=${next}`);
  expect(fetchMock.mock.calls[0][1].signal).toBe(fetchMock.mock.calls[1][1].signal);
 });

 it("discards stale item responses and never previews the prior item's base unit",async()=>{
  const first=deferred<ReturnType<typeof response>>(),second=deferred<ReturnType<typeof response>>();
  fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const view=render(<BusinessTransactionQuantity {...props({data:snapshot,selected:snapshot})}/>);
  view.rerender(<BusinessTransactionQuantity {...props({data:{...snapshot,item_id:itemB},selected:snapshot})}/>);
  expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("—");expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async()=>{second.resolve(response(units(5,today,"kg")));});
  await waitFor(()=>expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("10 kg"));
  await act(async()=>{first.resolve(response(units(12)));});
  expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("10 kg");
 });

 it.each([false,true])("uses only stored values for a sealed document or read-only parent line (readOnly=%s)",readOnly=>{
  const row=readOnly?{...snapshot,status:"active",purchase_order_id:order,unit_price:10}:{...snapshot,status:"posted"};
  render(<BusinessTransactionQuantity {...props({kind:readOnly?"purchase_lines":"stock_moves",data:row,selected:row,readOnly})}/>);
  expect(fetchMock).not.toHaveBeenCalled();expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeDisabled();expect(screen.getByLabelText("Số lượng nhập",{exact:false})).toBeDisabled();
  expect(screen.getByLabelText("Hệ số quy đổi")).toHaveValue("12");expect(screen.getByLabelText("Số lượng cơ sở")).toHaveValue("24 cái");expect(screen.getByLabelText("Đơn giá cơ sở")).toHaveValue("10");
 });

 it("allows retry without losing entered values or writing data",async()=>{
  fetchMock.mockResolvedValueOnce(response("Tạm thời chưa tải được đơn vị.",false)).mockResolvedValueOnce(response(units()));
  const changed=vi.fn();render(<Stateful initial={snapshot} selected={snapshot} onChange={changed}/>);
  await screen.findByRole("alert");expect(screen.getByRole("combobox",{name:"Đơn vị nhập"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Tải lại đơn vị"}));
  await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(changed).not.toHaveBeenCalled();expect(screen.getByLabelText("Số lượng nhập",{exact:false})).toHaveValue(2);expect(screen.getByLabelText("Đơn giá theo đơn vị nhập",{exact:false})).toHaveValue(120);
  expect(fetchMock.mock.calls.every(([,options])=>!options.method)).toBe(true);
 });

 it("applies the request deadline while fetching a parent and recovers through the same retry action",async()=>{
  const deadline=new AbortController();vi.spyOn(AbortSignal,"timeout").mockReturnValue(deadline.signal);
  fetchMock.mockImplementationOnce((_url:string,options:RequestInit)=>new Promise((_resolve,reject)=>options.signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")),{once:true})));
  render(<BusinessTransactionQuantity {...props({kind:"purchase_lines",data:{...base,purchase_order_id:order,unit_price:120}})}/>);
  await act(async()=>{deadline.abort();});
  expect(await screen.findByRole("alert")).toHaveTextContent("Tải đơn vị tính quá thời gian");expect(fetchMock).toHaveBeenCalledTimes(1);expect(AbortSignal.timeout).toHaveBeenCalledWith(15000);
 });

 it("rejects a response for the wrong date rather than showing an unverified factor",async()=>{
  fetchMock.mockResolvedValue(response(units(12,"2026-11-06")));render(<BusinessTransactionQuantity {...props()}/>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu đơn vị tính chưa hợp lệ");expect(screen.getByLabelText("Hệ số quy đổi")).toHaveValue("—");
 });

 it("keeps a positive base price visible when a large conversion would round it to zero",async()=>{
  fetchMock.mockResolvedValue(response(units(1e12)));
  render(<BusinessTransactionQuantity {...props({data:{...base,entry_unit:"thùng",entry_quantity:1,entry_price:1}})}/>);
  await waitFor(()=>expect(screen.getByLabelText("Đơn giá cơ sở")).toHaveValue("1E-12"));
 });
});
