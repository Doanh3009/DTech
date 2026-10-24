import { afterEach,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({redirect:vi.fn((path:string)=>{throw new Error(`redirect:${path}`);})}));
vi.mock("next/navigation",()=>({redirect:m.redirect}));
vi.mock("@/features/marketing/LandingPage",()=>({LandingPage:()=>null}));
import Home from "./page";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("keeps the public product landing on the DTech operator instance",()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","true");expect(Home()).toBeTruthy();expect(m.redirect).not.toHaveBeenCalled();});
it("customer ERP opens its own login instead of operator marketing",()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","false");expect(()=>Home()).toThrow("redirect:/login");});
