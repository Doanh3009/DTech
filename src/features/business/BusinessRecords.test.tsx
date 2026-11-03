import {fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
import type {BusinessWorkspace} from "./businessSchemas";
import {BusinessRecords} from "./BusinessRecords";
const w={tenantId:"tenant",slug:"acme",industry:"construction",features:["inventory"],role:"owner",accountId:"owner"} as BusinessWorkspace;
const row={id:"10000000-0000-4000-8000-000000000001",code:"VT01",name:"Thép hộp",status:"active",row_version:3,unit:"kg",tracking:"none",standard_cost:12000,notes:null};
const response=(data:unknown)=>new Response(JSON.stringify({ok:true,data}),{headers:{"content-type":"application/json"}});
describe("business record workspace",()=>{
 const fetchMock=vi.fn<typeof fetch>();
 beforeEach(()=>{vi.stubGlobal("fetch",fetchMock);fetchMock.mockReset().mockImplementation(async()=>response({records:[row],total:1}));});
 afterEach(()=>vi.unstubAllGlobals());
 it("validates the new form locally and focuses the first invalid field",async()=>{
  render(<BusinessRecords workspace={w} kind="items"/>);await screen.findByRole("button",{name:"VT01 Thép hộp"});fireEvent.click(screen.getByRole("button",{name:"Tạo mới"}));const dialog=screen.getByRole("dialog");fireEvent.click(within(dialog).getByRole("button",{name:"Lưu"}));expect(await screen.findByText("Kiểm tra các trường được đánh dấu.")).toHaveAttribute("role","alert");const code=within(dialog).getByRole("textbox",{name:"Mã"});await waitFor(()=>expect(code).toHaveFocus());expect(code).toHaveAttribute("aria-invalid","true");expect(fetchMock.mock.calls.every(([,options])=>!options?.method||options.method==="GET")).toBe(true);
 });
 it("preserves record identity and version while saving from the drawer footer",async()=>{
  fetchMock.mockImplementation(async(_url,options)=>options?.method==="POST"?response({id:row.id}):response({records:[row],total:1}));
  render(<BusinessRecords workspace={w} kind="items"/>);fireEvent.click(await screen.findByRole("button",{name:"VT01 Thép hộp"}));const dialog=screen.getByRole("dialog");fireEvent.change(within(dialog).getByRole("textbox",{name:"Tên"}),{target:{value:"Thép hộp cập nhật"}});const save=within(dialog).getByRole("button",{name:"Lưu"});expect(save.closest("footer")).not.toBeNull();fireEvent.click(save);await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());const call=fetchMock.mock.calls.find(([,options])=>options?.method==="POST")!;expect(call[0]).toBe("/api/v1/business/acme/records/items");expect(JSON.parse(String(call[1]?.body))).toMatchObject({recordId:row.id,rowVersion:3,data:{code:"VT01",name:"Thép hộp cập nhật",unit:"kg"}});
 });
 it("lets viewers inspect records and choose columns without write actions",async()=>{
  render(<BusinessRecords workspace={{...w,role:"viewer"}} kind="items"/>);await screen.findByRole("button",{name:"VT01 Thép hộp"});expect(screen.queryByRole("button",{name:"Tạo mới"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Cột hiển thị"}));const columns=screen.getByRole("dialog");const choices=within(columns).getAllByRole("checkbox");fireEvent.click(choices[0]);fireEvent.click(within(columns).getByRole("button",{name:"Xong"}));fireEvent.click(screen.getByRole("button",{name:"VT01 Thép hộp"}));expect(within(screen.getByRole("dialog")).queryByRole("button",{name:"Lưu"})).toBeNull();expect(within(screen.getByRole("dialog")).getByRole("textbox",{name:"Tên"})).toBeDisabled();expect(fetchMock).toHaveBeenCalledTimes(1);
 });
});
