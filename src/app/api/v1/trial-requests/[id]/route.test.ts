import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),review:vi.fn()}));
vi.mock("@/services/auth/getRequestUser",()=>({getRequestUser:mocks.user}));
vi.mock("@/features/marketing/trialRequestService",()=>({readTrialBody:(r:Request)=>r.json(),reviewTrialRequest:mocks.review}));
import { PATCH } from "./route";
const id="10000000-0000-4000-8000-000000000001";
const context={params:Promise.resolve({id})};
const request=()=>new Request("http://localhost/api/v1/trial-requests/test",{method:"PATCH",body:JSON.stringify({rowVersion:1,status:"contacted",reason:"Đã liên hệ"})});
beforeEach(()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","true");vi.clearAllMocks();mocks.user.mockResolvedValue(null);mocks.review.mockResolvedValue({requestId:id,rowVersion:2,status:"contacted"});});
describe("trial review API",()=>{
 it("requires authentication before parsing",async()=>{expect((await PATCH(request(),context)).status).toBe(401);expect(mocks.review).not.toHaveBeenCalled();});
 it("requires admin access and management permission",async()=>{mocks.user.mockResolvedValue({id:"actor",status:"active",permissions:["crm.view","trial_request.view"]});expect((await PATCH(request(),context)).status).toBe(403);expect(mocks.review).not.toHaveBeenCalled();});
 it("uses the server actor and returns the command receipt without a post-commit read",async()=>{mocks.user.mockResolvedValue({id:"trusted-actor",status:"active",permissions:["crm.view","trial_request.manage"]});const response=await PATCH(request(),context);expect(response.status).toBe(200);expect(mocks.review).toHaveBeenCalledWith(id,{rowVersion:1,status:"contacted",reason:"Đã liên hệ"},"trusted-actor");expect(mocks.review).toHaveBeenCalledOnce();});
});

afterEach(()=>vi.unstubAllEnvs());
