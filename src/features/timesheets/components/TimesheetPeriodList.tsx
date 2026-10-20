"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Input } from "@/components/shared/FormControls";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import type { TimesheetPeriod } from "../types/timesheetTypes";

const statusLabel = { open: "Mở", reviewing: "Đang rà soát", locked: "Đã khóa", reopened: "Đã mở lại" };

const periodColumns: DataTableColumn<TimesheetPeriod>[] = [
  { id: "period", header: "Kỳ công", cell: (item) => <Link className="table-link" href={`/timesheets/periods/${item.id}`}><strong>{item.name}</strong><br /><small>{item.code}</small></Link> },
  { id: "dates", header: "Thời gian", cell: (item) => `${item.startDate} – ${item.endDate}` },
  { id: "version", header: "Phiên bản", cell: (item) => `v${item.version}` },
  { id: "status", header: "Trạng thái", cell: (item) => <StatusBadge tone={item.status === "locked" ? "success" : item.status === "reviewing" ? "warning" : "neutral"}>{statusLabel[item.status]}</StatusBadge> }
];

export function TimesheetPeriodList({ canCreate = false, initialItems, initialError }: { canCreate?: boolean; initialItems?: TimesheetPeriod[]; initialError?: string }) {
  const [items, setItems] = useState<TimesheetPeriod[]>(initialItems ?? []);
  const [loading, setLoading] = useState(initialItems === undefined && !initialError);
  const [error, setError] = useState(initialError ?? "");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/timesheet-periods", { cache: "no-store" });
      const body = await response.json() as { data?: TimesheetPeriod[]; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải kỳ công.");
      setItems(body.data ?? []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải kỳ công.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialItems !== undefined || initialError) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [initialError, initialItems, load]);
  useDomainReconciliation("timesheets", load);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/timesheet-periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tạo kỳ công.");
      setShowForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo kỳ công.");
    }
  }

  return <ListPageLayout>
    {canCreate ? <div className="timesheet-period-actions"><Button onClick={() => setShowForm((value) => !value)} variant="primary">Tạo kỳ công</Button></div> : null}
    {showForm ? <Card><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input label="Mã kỳ" name="code" placeholder="2026-09" required />
      <Input label="Tên kỳ" name="name" required />
      <Input label="Từ ngày" name="startDate" required type="date" />
      <Input label="Đến ngày" name="endDate" required type="date" />
      <div className="form-actions"><Button type="submit" variant="primary">Lưu</Button></div>
    </form></Card> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <DataSurface><DataTable columns={periodColumns} data={items} emptyDescription="" emptyTitle="Chưa có kỳ công" getRowId={(item) => item.id} loading={loading} rowHrefPrefix="/timesheets/periods/" /></DataSurface>
  </ListPageLayout>;
}
