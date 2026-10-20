import { describe, expect, it } from "vitest";
import { defaultPayslipPeriod, formatPayslipPeriod, groupPayslips, matchesPayslipTracking, payslipGross, payslipListQuery, payslipNumber } from "./payslipPresentation";
import type { Payslip } from "./types";

const slip = (overrides: Partial<Payslip> = {}): Payslip => ({ id: "slip-1", payrollLineId: "line-1", employeeId: "employee-1", employeeCode: "NV001", employeeName: "Nguyễn Văn An", periodMonth: "2026-09-01", version: 1, status: "published", snapshot: { netSalary: 13_300_000 }, ...overrides });

describe("payslip browsing", () => {
  it("defaults to the current month or nearest past month instead of future test data", () => {
    expect(defaultPayslipPeriod([slip(), slip({ periodMonth: "2099-01-01" }), slip({ periodMonth: "2026-08-01" })], "2026-10-16")).toBe("2026-09");
    expect(defaultPayslipPeriod([slip(), slip({ periodMonth: "2026-10-01" })], "2026-10-16")).toBe("2026-10");
  });
  it("chooses the nearest future period only when no past period exists", () => {
    expect(defaultPayslipPeriod([slip({ periodMonth: "2099-01-01" }), slip({ periodMonth: "2085-01-01" })], "2026-10-16")).toBe("2085-01");
    expect(defaultPayslipPeriod([], "2026-10-16")).toBe("");
  });
  it("groups employee and month while preserving every historical version", () => {
    const records = [slip({ id: "old", status: "revoked" }), slip({ id: "new", version: 2 }), slip({ id: "other-person", employeeId: "employee-2" }), slip({ id: "other-month", periodMonth: "2026-08-01" })];
    const groups = groupPayslips(records);
    expect(groups).toHaveLength(3);
    const person = groups.find((group) => group.current.id === "new")!;
    expect(person.versions.map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(records[0].id).toBe("old");
  });
  it("keeps an issued version effective while a newer draft exists", () => {
    expect(groupPayslips([slip(), slip({ id: "draft", version: 2, status: "draft" })])[0].current.id).toBe("slip-1");
  });
  it("shows the newest revoked record if no issued version remains", () => {
    expect(groupPayslips([slip({ status: "draft" }), slip({ id: "revoked-new", version: 2, status: "revoked" })])[0].current.id).toBe("revoked-new");
  });
  it("partitions receipt states without counting revoked versions", () => {
    const unseen = slip(), pending = slip({ viewedAt: "2026-10-16T02:00:00Z" }), confirmed = slip({ confirmedAt: "2026-10-16T02:00:00Z" }), revoked = slip({ status: "revoked" });
    expect([unseen, pending, confirmed, revoked].filter((item) => matchesPayslipTracking(item, "unseen"))).toEqual([unseen]);
    expect([unseen, pending, confirmed, revoked].filter((item) => matchesPayslipTracking(item, "pending"))).toEqual([pending]);
    expect([unseen, pending, confirmed, revoked].filter((item) => matchesPayslipTracking(item, "confirmed"))).toEqual([confirmed]);
    expect(matchesPayslipTracking(revoked, "revoked")).toBe(true);
  });
  it("formats periods consistently and rejects unknown numeric values", () => {
    expect(formatPayslipPeriod("2026-09-01")).toBe("09/2026");
    expect(formatPayslipPeriod("")).toBe("—");
    expect(payslipNumber(undefined)).toBeUndefined();
    expect(payslipNumber("invalid")).toBeUndefined();
    expect(payslipNumber("0")).toBe(0);
  });
  it("adds cashout once and preserves unknown income instead of inventing zero", () => {
    expect(payslipGross({ baseSalary: 12_000_000, allowance: 1_000_000, bonus: 500_000, leaveCashoutAmount: 300_000 })).toBe(13_800_000);
    expect(payslipGross({ baseSalary: 12_000_000, allowance: 0, bonus: 0 })).toBe(12_000_000);
    expect(payslipGross({})).toBeUndefined();
  });
  it("preserves month, tracking and personal scope in detail return links", () => {
    expect(payslipListQuery("2026-09", "pending", true)).toBe("?scope=self&month=2026-09&receipt=pending");
    expect(payslipListQuery("all", "all")).toBe("?month=all");
  });
  it("rejects malformed query values instead of copying them into navigation", () => {
    expect(payslipListQuery("2026-13", "other")).toBe("");
    expect(payslipListQuery(["2026-09"], ["unseen"])).toBe("");
    expect(payslipListQuery("https://example.invalid", "pending")).toBe("?receipt=pending");
  });
});
