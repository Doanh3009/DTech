// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cohortPayrollPeriod } from "./personal.mjs";
function database(rows) {
  const from = vi.fn(() => {
    const row = rows.shift();
    const query = { select: () => query, eq: vi.fn(() => query), single: async () => ({ data: row, error: null }) };
    return query;
  });
  return { from };
}
const account = { employee_id: "fixture-employee", metadata: { seedBatch: "test-users-50" } };
const line = { employee_id: account.employee_id, payroll_period_id: "reused-test-period" };
const period = { id: line.payroll_period_id, note: "[TEST DATA] Phiếu lương cá nhân", status: "published" };
describe("QA personal data uses the cohort's actual payroll period", () => {
  it("accepts a reused test period rather than assuming a fixed period ID", async () => {
    const db = database([account, line, period]);
    expect(await cohortPayrollPeriod(db)).toEqual(period);
    expect(db.from).toHaveBeenCalledTimes(3);
  });
  it("rejects accounts outside the seeded cohort before finding a period", async () => {
    const db = database([{ ...account, metadata: {} }]);
    await expect(cohortPayrollPeriod(db)).rejects.toThrow("Cần seed cohort 50");
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it("rejects a payroll line linked to a different employee", async () => {
    const db = database([account, { ...line, employee_id: "other-employee" }]);
    await expect(cohortPayrollPeriod(db)).rejects.toThrow("Dòng lương không thuộc cohort 50");
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it.each([{ ...period, note: "production" }, { ...period, status: "draft" }])("rejects a non-test or unpublished period", async (invalid) => {
    await expect(cohortPayrollPeriod(database([account, line, invalid]))).rejects.toThrow("Kỳ lương cohort chưa phát hành");
  });
});
