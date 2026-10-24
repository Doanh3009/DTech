import { describe, expect, it } from "vitest";
import { salesDeliverySchema } from "./salesFulfillment";

const id = "10000000-0000-4000-8000-000000000001";
const input = { requestId: id, rowVersion: 2, documentDate: "2026-10-23", lines: [{ itemId: id, warehouseId: id, lotId: null, quantity: 0.0001, unitCost: 0 }] };
describe("sales delivery input", () => {
 it("accepts a zero reference cost and four-decimal quantities", () => expect(salesDeliverySchema.safeParse(input).success).toBe(true));
 it("refuses a zero quantity, extra tenant fields and precision that the ledger cannot store", () => {
  for (const quantity of [0, -1, 0.00001, Infinity]) expect(salesDeliverySchema.safeParse({ ...input, lines: [{ ...input.lines[0], quantity }] }).success).toBe(false);
  expect(salesDeliverySchema.safeParse({ ...input, tenantId: id }).success).toBe(false);
  expect(salesDeliverySchema.safeParse({ ...input, lines: [{ ...input.lines[0], source_id: id }] }).success).toBe(false);
 });
 it("refuses invalid dates and unbounded batches", () => {
  expect(salesDeliverySchema.safeParse({ ...input, documentDate: "2026-02-30" }).success).toBe(false);
  expect(salesDeliverySchema.safeParse({ ...input, lines: [] }).success).toBe(false);
  expect(salesDeliverySchema.safeParse({ ...input, lines: Array(51).fill(input.lines[0]) }).success).toBe(false);
 });
});
