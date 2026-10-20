import { describe, expect, it } from "vitest";
import { cashoutAmounts } from "./cashoutPresentation";
describe("cashoutAmounts", () => {
  it("preserves legacy bonus", () => expect(cashoutAmounts({ bonus: 500_000 })).toEqual({ bonus: 500_000, leaveCashoutAmount: 0 }));
  it("separates the cashout already counted in stored bonus", () => expect(cashoutAmounts({ bonus: 1_250_000, leave_cashout_amount: 750_000 })).toEqual({ bonus: 500_000, leaveCashoutAmount: 750_000 }));
});
