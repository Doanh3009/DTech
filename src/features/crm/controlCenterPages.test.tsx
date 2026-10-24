import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { render,screen } from "@testing-library/react";
const m=vi.hoisted(()=>({user:vi.fn()}));
vi.mock("@/services/auth/getRequestUser",()=>({getRequestUser:m.user}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("not-found");},redirect:(s:string)=>{throw new Error(`redirect:${s}`);}}));
vi.mock("@/features/marketing/TrialRequestsPage",()=>({TrialRequestsPage:()=> <h1>Trial inbox fixture</h1>}));
vi.mock("@/features/crm/CustomerWorkspace",()=>({CustomerWorkspace:()=> <h1>New customer fixture</h1>}));
import Trials from "@/app/control-center/(workspace)/trials/page";
import NewCustomer from "@/app/control-center/(workspace)/customers/new/page";
beforeEach(()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","true");m.user.mockResolvedValue(null);});afterEach(()=>vi.unstubAllEnvs());
for(const Page of [()=>Trials(),()=>NewCustomer({searchParams:Promise.resolve({})})]){
 it("disabled portal responds as not found instead of a render error",async()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","false");await expect(Page()).rejects.toThrow("not-found");});
 it("anonymous deep link opens the operator login",async()=>{await expect(Page()).rejects.toThrow("redirect:/control-center/login");});
 it("missing permission renders a denial instead of throwing an API exception",async()=>{m.user.mockResolvedValue({id:"reader",status:"active",permissions:["crm.view"]});render(await Page());expect(screen.getByRole("heading",{name:"Không có quyền truy cập"})).toBeInTheDocument();});
}
