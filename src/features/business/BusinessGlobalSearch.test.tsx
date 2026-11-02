import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {BusinessWorkspace} from "./businessSchemas";
import {BusinessGlobalSearch} from "./BusinessGlobalSearch";
const workspace={slug:"acme"} as BusinessWorkspace;
describe("business search keyboard navigation",()=>{
 beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,data:{results:[{id:"1",kind:"items",label:"Vật tư",code:"VT01",name:"Thép",updatedAt:"2026-11-02"}]}})))));
 afterEach(()=>vi.unstubAllGlobals());
 it("keeps results open while moving focus into a result and closes on Escape",async()=>{
  render(<BusinessGlobalSearch workspace={workspace}/>);const input=screen.getByRole("searchbox",{name:"Tìm mã hoặc tên"});input.focus();fireEvent.change(input,{target:{value:"VT"}});
  const link=await screen.findByRole("link",{name:"Vật tư · VT01 Thép"});fireEvent.keyDown(input,{key:"ArrowDown"});expect(link).toHaveFocus();expect(screen.getByRole("region",{name:"Kết quả tìm kiếm"})).toBeVisible();fireEvent.keyDown(link,{key:"Escape"});expect(input).toHaveFocus();expect(screen.queryByRole("region",{name:"Kết quả tìm kiếm"})).not.toBeInTheDocument();
 });
 it("clears stale results and does not search below the minimum query length",async()=>{
  render(<BusinessGlobalSearch workspace={workspace}/>);const input=screen.getByRole("searchbox");input.focus();fireEvent.change(input,{target:{value:"VT"}});await screen.findByRole("link");fireEvent.change(input,{target:{value:"V"}});await waitFor(()=>expect(screen.queryByRole("link")).not.toBeInTheDocument());expect(fetch).toHaveBeenCalledTimes(1);
 });
});
