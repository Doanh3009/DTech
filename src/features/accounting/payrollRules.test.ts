import { describe, expect, it } from "vitest";
import { calculatePayrollInput, payrollInputIssues, type PayrollInputEmployee, type PayrollReadiness } from "./payrollRules";
const employee:PayrollInputEmployee={employeeId:"e",employeeName:"An",employeeCode:"NV01",scheduledWorkdays:22,actualWorkdays:19,annualLeaveDays:2,businessTripDays:1,businessTripExtraDays:1,dailyCount:31,dailyWorkdays:19,salaryHistoryId:"s",contractSalary:22_000_000,allowance:1_000_000,bonus:500_000,deduction:300_000};
const input:PayrollReadiness={timesheetId:"t",timesheetStatus:"locked",timesheetVersion:2,calculatedTimesheetVersion:2,payBasis:"actual",employees:[employee],openHighExceptions:0};
describe("payroll input reconciliation",()=>{
  it("accepts a locked, reconciled roster with effective salary",()=>expect(payrollInputIssues(input)).toEqual([]));
  it("detects missing salary, daily source, schedule and open conflicts",()=>{
    const issues=payrollInputIssues({...input,timesheetStatus:"reviewing",openHighExceptions:1,employees:[{...employee,salaryHistoryId:undefined,dailyCount:0,scheduledWorkdays:0}]});
    expect(issues.map(item=>item.code)).toEqual(expect.arrayContaining(["unlocked","exceptions","salary","daily","scheduled"]));
  });
  it("detects summary mismatches rather than inventing daily records",()=>expect(payrollInputIssues({...input,employees:[{...employee,dailyWorkdays:18}]}).map(item=>item.code)).toContain("mismatch"));
  it("keeps actual-time and paid-time formulas explicit",()=>{
    expect(calculatePayrollInput(employee,"actual")).toMatchObject({payableWorkdays:19,baseSalary:19_000_000,net:20_200_000});
    expect(calculatePayrollInput(employee,"paid_time")).toMatchObject({payableWorkdays:22,baseSalary:22_000_000,net:23_200_000});
  });
  it("caps payable days and never counts worked business trips twice",()=>expect(calculatePayrollInput({...employee,businessTripExtraDays:0,annualLeaveDays:4},"paid_time").payableWorkdays).toBe(22));
  it("rejects zero standard days",()=>expect(()=>calculatePayrollInput({...employee,scheduledWorkdays:0},"actual")).toThrow());
});
