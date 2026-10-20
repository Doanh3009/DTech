import type { InventoryDocumentType, StockLedgerEntry } from "@/features/warehouse/types/warehouseTypes";
export function signedQuantity(type: InventoryDocumentType, quantity: number, side: "source" | "target" = "target", adjustmentQuantity?: number) { if (type === "receipt") return quantity; if (type === "issue") return -quantity; if (type === "transfer") return side === "source" ? -quantity : quantity; if (type === "adjustment") return adjustmentQuantity ?? 0; return side === "source" ? -quantity : quantity; }
export function canEditDocument(status: string) { return status === "draft"; }
export function wouldCreateNegativeStock(onHand: number, delta: number) { return onHand + delta < 0; }
export function reconcileBalance(ledger: Pick<StockLedgerEntry, "warehouseId" | "itemId" | "signedQuantity">[], balances: Array<{ warehouseId: string; itemId: string; onHand: number }>) { const sums = new Map<string, number>(); for (const row of ledger) { const key = `${row.warehouseId}:${row.itemId}`; sums.set(key, (sums.get(key) ?? 0) + row.signedQuantity); } return balances.flatMap((balance) => { const ledgerQuantity = sums.get(`${balance.warehouseId}:${balance.itemId}`) ?? 0; return ledgerQuantity === balance.onHand ? [] : [{ ...balance, ledgerQuantity, difference: balance.onHand - ledgerQuantity }]; }); }
export interface PostingModel { balance: number; postedDocumentIds: ReadonlySet<string>; ledger: ReadonlyArray<{ documentId: string; delta: number; runningBalance: number }>; }
export function postMovement(state: PostingModel, documentId: string, delta: number, allowNegative = false): PostingModel {
  if (state.postedDocumentIds.has(documentId)) return state;
  const next = state.balance + delta;
  if (!allowNegative && next < 0) throw new Error("INSUFFICIENT_STOCK");
  return { balance: next, postedDocumentIds: new Set([...state.postedDocumentIds, documentId]), ledger: [...state.ledger, { documentId, delta, runningBalance: next }] };
}
export function reconcileExpectedQuantity(snapshotQuantity: number, movementsAfterSnapshot: readonly number[]) { return movementsAfterSnapshot.reduce((sum, movement) => sum + movement, snapshotQuantity); }
