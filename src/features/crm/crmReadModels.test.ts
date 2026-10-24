import { beforeEach,it,expect,vi } from "vitest";
const m=vi.hoisted(()=>({client:vi.fn(),abort:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServiceClient:m.client}));
import { listTrialRequests } from "@/features/marketing/trialRequestService";
const id="10000000-0000-4000-8000-000000000001";
const row={request_id:id,created_at:"2026-10-23",company_name:"Synthetic company",contact_name:"Synthetic contact",email:"contact@example.invalid",phone:"0901234567",industry:"construction",company_size:"20_100",needs:"Synthetic needs",status:"qualified",row_version:3,review_note:null,reviewed_at:null,qualification:{}};
const q={select:vi.fn(),order:vi.fn(),ilike:vi.fn(),eq:vi.fn(),range:vi.fn(),abortSignal:m.abort};
beforeEach(()=>{vi.clearAllMocks();m.client.mockReturnValue({from:()=>q});for(const key of ["select","order","ilike","eq","range"] as const)q[key].mockReturnValue(q);});
for(const join of [{id},[{id}]])it(`reads one-to-one lead linkage ${Array.isArray(join)?"array":"object"}`,async()=>{m.abort.mockResolvedValue({data:[{...row,customers:join}],count:70,error:null});const data=await listTrialRequests(3,"O'Reilly","qualified");expect(data.requests[0].customerId).toBe(id);expect(data.total).toBe(70);expect(q.range).toHaveBeenCalledWith(50,74);expect(q.ilike).toHaveBeenCalledWith("company_name","%O'Reilly%");expect(q.eq).toHaveBeenCalledWith("status","qualified");});
