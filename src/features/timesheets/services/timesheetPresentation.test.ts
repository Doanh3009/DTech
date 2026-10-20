import {describe,expect,it} from "vitest";
import {calendarWeeks,defaultPeriod,periodDates,reconcileTimesheet} from "./timesheetPresentation";
import type {TimesheetPeriod,TimesheetSummary} from "../types/timesheetTypes";
describe("timesheet calendar presentation",()=>{
  it("places October 1st in Thursday and keeps all 31 days",()=>{const weeks=calendarWeeks(periodDates("2026-10-01","2026-10-31"));expect(weeks[0]).toEqual([null,null,null,"2026-10-01","2026-10-02","2026-10-03","2026-10-04"]);expect(weeks.flat().filter(Boolean)).toHaveLength(31);});
  it("supports the existing 93-day maximum without dropping dates",()=>expect(periodDates("2026-01-01","2026-04-03")).toHaveLength(93));
  it("prefers the current period over future test fixtures",()=>{const periods=[{id:"future",startDate:"2099-01-01",endDate:"2099-01-31"},{id:"current",startDate:"2026-10-01",endDate:"2026-10-31"}] as TimesheetPeriod[];expect(defaultPeriod(periods,"2026-10-12")).toBe("current");});
  it("reports a total with no source days as inconsistent",()=>expect(reconcileTimesheet({actualWorkdays:21} as TimesheetSummary,[])).toEqual({actual:0,hasDaily:false,mismatch:true}));
});
