import { describe, expect, it } from "vitest";
import { calculateLeaveDays, summarizeLedger, withPending } from "./leaveRules";
import type { LeaveLedgerEntry } from "@/features/leave/types/leaveTypes";

const entry=(transactionType:LeaveLedgerEntry["transactionType"],amount:number):LeaveLedgerEntry=>({id:crypto.randomUUID(),employeeId:"employee",leaveYear:2026,leaveTypeId:"annual",leaveTypeName:"Phép năm",transactionType,amount,referenceType:"test",referenceId:crypto.randomUUID(),effectiveDate:"2026-01-01",reason:"Kiểm thử",createdAt:new Date().toISOString()});
describe("leave rules",()=>{
  it("excludes weekends and holidays and supports half days",()=>{expect(calculateLeaveDays({startDate:"2026-09-10",endDate:"2026-09-15",startDayPart:"afternoon",endDayPart:"morning",weekendDays:[0,6],holidays:["2026-09-14"]})).toBe(2);});
  it("derives official and available balance from the immutable ledger",()=>{const summary=summarizeLedger([entry("grant",12),entry("carryover",2),entry("adjustment_subtract",-1),entry("leave_usage",-3),entry("leave_reversal",1)]);expect(summary).toEqual({granted:12,carryover:2,adjustments:-1,used:2,officialRemaining:11});expect(withPending({employeeId:"e",employeeCode:"E",employeeName:"A",departmentName:"D",year:2026,leaveTypeId:"l",leaveTypeName:"P",...summary},2).availableAfterPending).toBe(9);});
  it("reduces remaining balance for expiry without counting expired days as leave used",()=>{
    expect(summarizeLedger([entry("grant",12),entry("leave_usage",-4),entry("leave_reversal",1),entry("expiry",-2)])).toEqual({granted:12,carryover:0,adjustments:0,used:3,officialRemaining:7});
  });
  it("closes unused balance through cashout without inflating days used",()=>{
    const cashout={...entry("adjustment_subtract",-8),referenceType:"leave_year_end_cashout"};
    expect(summarizeLedger([entry("grant",12),entry("leave_usage",-4),cashout])).toEqual({granted:12,carryover:0,adjustments:-8,used:4,officialRemaining:0});
  });
});
