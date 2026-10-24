import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { validTrial } from "@/features/marketing/testFixtures";
const mocks=vi.hoisted(()=>({user:vi.fn(),submit:vi.fn(),list:vi.fn()}));
vi.mock("@/services/auth/getRequestUser",()=>({getRequestUser:mocks.user}));
vi.mock("@/features/marketing/trialRequestService",()=>({readTrialBody:(request:Request)=>request.json(),submitTrialRequest:mocks.submit,listTrialRequests:mocks.list}));
import { GET,POST } from "./route";
beforeEach(()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","true");vi.clearAllMocks();mocks.user.mockResolvedValue(null);mocks.submit.mockResolvedValue({requestId:validTrial.requestId,received:true});mocks.list.mockResolvedValue({requests:[]});});
describe("trial intake API",()=>{
 it("accepts a validated anonymous lead and returns only a receipt",async()=>{const response=await POST(new Request("http://localhost/api/v1/trial-requests",{method:"POST",body:JSON.stringify(validTrial),headers:{"x-forwarded-for":"192.0.2.10, 192.0.2.20"}}));expect(response.status).toBe(202);expect(await response.json()).toEqual({ok:true,data:{requestId:validTrial.requestId,received:true}});expect(mocks.user).not.toHaveBeenCalled();expect(mocks.submit).toHaveBeenCalledWith(validTrial,"192.0.2.10");expect(response.headers.get("cache-control")).toBe("no-store");});
 it("never stores a submission without affirmative consent",async()=>{const response=await POST(new Request("http://localhost",{method:"POST",body:JSON.stringify({...validTrial,consent:false})}));expect(response.status).toBe(400);expect(mocks.submit).not.toHaveBeenCalled();});
 it("keeps lead listing private even though POST is public",async()=>{expect((await GET(new Request("http://localhost/api/v1/trial-requests"))).status).toBe(401);expect(mocks.list).not.toHaveBeenCalled();});
 for(const permissions of [["system_admin.access"],["trial_request.view"],[]])it(`requires both permissions: ${permissions.join(",")}`,async()=>{mocks.user.mockResolvedValue({id:"actor",status:"active",permissions});expect((await GET(new Request("http://localhost/api/v1/trial-requests"))).status).toBe(403);expect(mocks.list).not.toHaveBeenCalled();});
 it("allows an authorized admin to read the bounded list",async()=>{mocks.user.mockResolvedValue({id:"actor",status:"active",permissions:["crm.view","trial_request.view"]});const result=await GET(new Request("http://localhost/api/v1/trial-requests"));expect(result.status).toBe(200);expect(await result.json()).toEqual({ok:true,data:{requests:[]}});});
});

afterEach(()=>vi.unstubAllEnvs());
