/** Stored bonus includes cashout to preserve the database generated net formula. */
export function cashoutAmounts(snapshot: Record<string, unknown>) {
  const cashout = Number(snapshot.leaveCashoutAmount ?? snapshot.leave_cashout_amount ?? 0);
  return { bonus: Number(snapshot.bonus ?? 0) - cashout, leaveCashoutAmount: cashout };
}
