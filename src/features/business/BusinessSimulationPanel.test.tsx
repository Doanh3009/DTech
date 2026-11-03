import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {BusinessSimulationPanel} from "./BusinessSimulationPanel";
const response=(data:unknown)=>new Response(JSON.stringify({ok:true,data}),{headers:{"content-type":"application/json"}});
describe("provider simulation interactions",()=>{
 const fetchMock=vi.fn<typeof fetch>();beforeEach(()=>{vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset();});afterEach(()=>vi.unstubAllGlobals());
 it("retains the same command after an unknown response and prevents a second new request",async()=>{
  const onPending=vi.fn();let posts=0;fetchMock.mockImplementation(async(_url,options)=>{if(options?.method==="POST"){posts++;return posts===1?new Response(JSON.stringify({ok:false,error:{message:"Kết quả chưa xác nhận"}}),{status:503}):response({simulationId:"simulation-id"});}return response({requests:[],canStart:true,sourceVersion:3});});
  render(<BusinessSimulationPanel slug="acme" kind="cash_vouchers" id="document-id" version={3} status="posted" disabled={false} onPending={onPending}/>);
  fireEvent.click(await screen.findByRole("button",{name:"Nhận sao kê mô phỏng"}));await screen.findByText("Kết quả chưa xác nhận");expect(screen.getByRole("button",{name:"Nhận sao kê mô phỏng"})).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Thử lại cùng yêu cầu"}));await screen.findByText("Đã ghi nhận mô phỏng");const commands=fetchMock.mock.calls.filter(([,options])=>options?.method==="POST");expect(commands).toHaveLength(2);expect(commands[0][1]?.body).toBe(commands[1][1]?.body);expect(onPending).toHaveBeenLastCalledWith(false);
 });
 it("refreshes a confirmed command without posting again when loading receipts fails",async()=>{
  let reads=0;fetchMock.mockImplementation(async(_url,options)=>{if(options?.method==="POST")return response({simulationId:"simulation-id"});reads++;return reads===2?new Response(JSON.stringify({ok:false,error:{message:"Không tải được biên nhận"}}),{status:503}):response({requests:[],canStart:true,sourceVersion:3});});
  render(<BusinessSimulationPanel slug="acme" kind="cash_vouchers" id="document-id" version={3} status="posted" disabled={false} onPending={()=>{}}/>);fireEvent.click(await screen.findByRole("button",{name:"Nhận sao kê mô phỏng"}));await screen.findByText("Không tải được biên nhận");expect(screen.queryByRole("button",{name:"Thử lại cùng yêu cầu"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Tải lại"}));await waitFor(()=>expect(reads).toBe(3));expect(fetchMock.mock.calls.filter(([,options])=>options?.method==="POST")).toHaveLength(1);
 });
 it("provides read-only receipt inspection for viewers",async()=>{fetchMock.mockResolvedValue(response({requests:[],canStart:false,sourceVersion:3}));render(<BusinessSimulationPanel slug="acme" kind="cash_vouchers" id="document-id" version={3} status="posted" disabled={false} onPending={()=>{}}/>);await screen.findByText("Chưa có yêu cầu mô phỏng");expect(screen.queryByRole("button",{name:"Nhận sao kê mô phỏng"})).toBeNull();expect(fetchMock.mock.calls.every(([,options])=>!options?.method)).toBe(true);});
});
