import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const {client}=vi.hoisted(()=>({client:{from:vi.fn()}}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServiceClient:()=>client}));
import {getPeriod} from "./timesheetRepository";
import type {AuthenticatedUser} from "@/lib/auth/permissions";

describe("period exception counts",()=>{
  it("counts open exceptions from the queue rather than closed source flags",async()=>{
    const rows:Record<string,Array<Record<string,unknown>>>={
      timesheet_period_summaries:[{id:"summary",employee_id:"employee",employee_snapshot:{},exception_count:8}],
      daily_timesheets:[{id:"day",employee_id:"employee",employee_snapshot:{},status:"full_work",exception_count:8}],
      timesheet_exceptions:[{id:"open",employee_id:"employee",daily_timesheet_id:"day",severity:"high",status:"open"},{id:"closed",employee_id:"employee",daily_timesheet_id:"day",severity:"high",status:"resolved"}]
    };
    client.from.mockImplementation((table:string)=>{
      class Query {
        status?:string;
        select(){return this;}
        eq(key:string,value:string){if(key==="status")this.status=value;return this;}
        order(){return this;}
        in(){return this;}
        range(){return this;}
        then(resolve:(result:{data:Record<string,unknown>[];error:null})=>unknown){return resolve({data:(rows[table]??[]).filter(item=>!this.status||item.status===this.status),error:null});}
        async maybeSingle(){return{data:{id:"period",status:"reviewing"},error:null};}
      }
      return new Query();
    });
    const detail=await getPeriod({permissions:["timesheet.view_all"]} as AuthenticatedUser,"period");
    expect(detail.summaries[0].exceptionCount).toBe(1);expect(detail.daily[0].exceptionCount).toBe(1);expect(detail.openHighExceptionCount).toBe(1);
  });
});
