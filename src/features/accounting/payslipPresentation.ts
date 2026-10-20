import { getBusinessDateKey } from "@/lib/time/timezone";
import type { Payslip } from "./types";

export interface PayslipGroup {
  key: string;
  current: Payslip;
  versions: Payslip[];
}

export type PayslipTracking = "all" | "unseen" | "pending" | "confirmed" | "revoked" | "draft";

export function parsePayslipTracking(value: unknown): PayslipTracking {
  return value === "unseen" || value === "pending" || value === "confirmed" || value === "revoked" || value === "draft" ? value : "all";
}

export function payslipListQuery(month: unknown, receipt: unknown, selfScope = false): string {
  const query = new URLSearchParams();
  if (selfScope) query.set("scope", "self");
  if (typeof month === "string" && (month === "all" || /^\d{4}-(0[1-9]|1[0-2])$/.test(month))) query.set("month", month);
  const tracking = parsePayslipTracking(receipt);
  if (tracking !== "all") query.set("receipt", tracking);
  return query.size ? `?${query.toString()}` : "";
}

export const payslipPeriodKey = (item: Payslip) => item.periodMonth.slice(0, 7);

export function formatPayslipPeriod(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[2]}/${match[1]}` : "—";
}

/** A future test period must not become the default simply because it sorts last. */
export function defaultPayslipPeriod(items: Payslip[], today = getBusinessDateKey()): string {
  const periods = [...new Set(items.map(payslipPeriodKey).filter((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)))].sort();
  const current = today.slice(0, 7);
  return periods.filter((value) => value <= current).at(-1) ?? periods[0] ?? "";
}

function versionOrder(a: Payslip, b: Payslip): number {
  return b.version - a.version || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.id.localeCompare(b.id);
}

/** An issued version remains effective until it is revoked; drafts never replace it. */
export function groupPayslips(items: Payslip[]): PayslipGroup[] {
  const grouped = new Map<string, Payslip[]>();
  for (const item of items) {
    const key = `${item.employeeId}:${payslipPeriodKey(item)}`;
    const versions = grouped.get(key) ?? [];
    versions.push(item);
    grouped.set(key, versions);
  }
  return [...grouped.entries()].map(([key, versions]) => {
    versions.sort(versionOrder);
    const current = versions.find((item) => item.status === "published") ?? versions[0];
    return { key, current, versions };
  }).sort((a, b) => payslipPeriodKey(b.current).localeCompare(payslipPeriodKey(a.current))
    || a.current.employeeName.localeCompare(b.current.employeeName, "vi") || a.key.localeCompare(b.key));
}

export function matchesPayslipTracking(item: Payslip, tracking: PayslipTracking): boolean {
  if (tracking === "all") return true;
  if (tracking === "revoked" || tracking === "draft") return item.status === tracking;
  if (item.status !== "published") return false;
  if (tracking === "unseen") return !item.viewedAt && !item.confirmedAt;
  if (tracking === "pending") return Boolean(item.viewedAt) && !item.confirmedAt;
  return Boolean(item.confirmedAt);
}

export function payslipNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function payslipGross(snapshot: Record<string, unknown>): number | undefined {
  const parts = [snapshot.baseSalary, snapshot.allowance, snapshot.bonus, snapshot.leaveCashoutAmount ?? 0].map(payslipNumber);
  return parts.every((part) => part !== undefined) ? parts.reduce<number>((sum, part) => sum + (part ?? 0), 0) : undefined;
}
