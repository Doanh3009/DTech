import { describe, expect, it } from "vitest";
import { inventoryDocumentSchema } from "@/features/warehouse/schemas/warehouseSchemas";
import { canEditDocument, postMovement, reconcileBalance, reconcileExpectedQuantity, signedQuantity, wouldCreateNegativeStock } from "@/features/warehouse/services/inventoryRules";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
describe("inventory rules", () => {
  it("maps receipt and issue signs on the server", () => { expect(signedQuantity("receipt", 10)).toBe(10); expect(signedQuantity("issue", 10)).toBe(-10); });
  it("creates paired transfer signs", () => { expect(signedQuantity("transfer", 5, "source")).toBe(-5); expect(signedQuantity("transfer", 5, "target")).toBe(5); });
  it("uses explicit adjustment delta", () => expect(signedQuantity("adjustment", 8, "source", -3)).toBe(-3));
  it("blocks direct edits after draft", () => { expect(canEditDocument("draft")).toBe(true); expect(canEditDocument("posted")).toBe(false); });
  it("detects negative stock", () => expect(wouldCreateNegativeStock(10, -11)).toBe(true));
  it("rejects same-warehouse transfer", () => expect(inventoryDocumentSchema.safeParse({ type: "transfer", documentDate: "2026-09-12", transactionTypeCode: "TRANSFER", sourceWarehouseId: id(1), targetWarehouseId: id(1), lines: [{ itemId: id(2), quantity: 1, uomId: id(3) }] }).success).toBe(false));
  it("rejects duplicate item lines", () => expect(inventoryDocumentSchema.safeParse({ type: "receipt", documentDate: "2026-09-12", transactionTypeCode: "PURCHASE", targetWarehouseId: id(1), lines: [{ itemId: id(2), quantity: 1, uomId: id(3) }, { itemId: id(2), quantity: 2, uomId: id(3) }] }).success).toBe(false));
  it("reconciles ledger and cached balance", () => expect(reconcileBalance([{ warehouseId: "w", itemId: "i", signedQuantity: 5 }] as never, [{ warehouseId: "w", itemId: "i", onHand: 4 }])).toEqual([{ warehouseId: "w", itemId: "i", onHand: 4, ledgerQuantity: 5, difference: -1 }]));
  it("posts a document idempotently", () => { const initial = { balance: 10, postedDocumentIds: new Set<string>(), ledger: [] }; const posted = postMovement(initial, "PXK-1", -4); expect(postMovement(posted, "PXK-1", -4)).toBe(posted); expect(posted.balance).toBe(6); expect(posted.ledger).toHaveLength(1); });
  it("allows only one competing issue when combined quantity exceeds stock", () => { const initial = { balance: 10, postedDocumentIds: new Set<string>(), ledger: [] }; const first = postMovement(initial, "PXK-1", -7); expect(() => postMovement(first, "PXK-2", -7)).toThrow("INSUFFICIENT_STOCK"); expect(first.balance).toBe(3); });
  it("reconciles count snapshot with movements", () => expect(reconcileExpectedQuantity(10, [5, -2])).toBe(13));
});
