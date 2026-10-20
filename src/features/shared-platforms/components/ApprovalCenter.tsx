"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Inspector, WorkbenchLayout, WorkCanvas } from "@/components/shared/Workbench";
import type { ApprovalCase } from "@/features/shared-platforms/types";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";

const domainLabels: Record<string, string> = { LEAVE: "Nghỉ phép", TIMESHEET_ADJUSTMENT: "Điều chỉnh công", WAREHOUSE: "Kho", IMPORT_EXPORT: "Xuất nhập khẩu" };
const statusLabels: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Đã từ chối", cancelled: "Đã hủy", withdrawn: "Đã rút" };

function hasValue(value?: string) {
  return Boolean(value?.trim() && value.trim() !== "—");
}

function waitLabel(hours: number) {
  if (hours < 1) return "Mới gửi";
  if (hours < 24) return `Chờ ${hours} giờ`;
  return `Chờ ${Math.floor(hours / 24)} ngày`;
}

export function ApprovalCenter({ view }: { view: "pending" | "completed" | "delegated" }) {
  const [items, setItems] = useState<ApprovalCase[]>([]);
  const [selected, setSelected] = useState<ApprovalCase>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useLoadingActivity(refreshing);
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await fetch(`/api/v1/approvals?view=${view}`, { cache: "no-store" });
      const body = await response.json() as { data?: ApprovalCase[]; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải yêu cầu.");
      const nextItems = body.data ?? [];
      setItems(nextItems);
      setSelected((current) => current ? nextItems.find((item) => item.id === current.id) : undefined);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải yêu cầu.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [view]);

  const reconcile = useCallback(() => load(false), [load]);
  useEffect(() => { queueMicrotask(() => void load(true)); }, [load]);
  useDomainReconciliation("approvals", reconcile);

  if (loading) return <LoadingState title="Đang tải hàng đợi phê duyệt" description="" />;
  if (error && !items.length) return <ErrorState description={error} />;
  if (!items.length) return <EmptyState title={view === "pending" ? "Không có yêu cầu đang chờ" : "Chưa có yêu cầu"} />;

  return (
    <WorkbenchLayout className={selected ? "approval-queue" : "approval-queue workbench-layout--solo"}>
      <WorkCanvas className="approval-queue__canvas">
        <div aria-busy={refreshing} className="approval-queue__status"><span>{items.length} yêu cầu</span></div>
        <div className="platform-table platform-table--approvals" role="group" aria-label="Yêu cầu phê duyệt">
          <div className="platform-table__head" aria-hidden="true"><span>Loại yêu cầu</span><span>Nội dung</span><span>Trạng thái</span><span>{view === "pending" ? "Thời gian chờ" : "Ngày xử lý"}</span></div>
          {items.map((item) => <button aria-pressed={selected?.id === item.id} className={`platform-table__row${selected?.id === item.id ? " is-selected" : ""}`} key={item.id} onClick={() => setSelected((current) => current?.id === item.id ? undefined : item)} type="button">
            <span className="approval-queue__type" data-label="Loại yêu cầu">{domainLabels[item.domainType] ?? item.domainType}</span>
            <span className="approval-queue__summary" data-label="Nội dung"><strong>{item.summary}</strong>{hasValue(item.requesterName) ? <small>{item.requesterName}</small> : null}</span>
            <span className="approval-queue__state" data-label="Trạng thái"><StatusBadge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "error" : item.status === "pending" ? "warning" : "neutral"}>{statusLabels[item.status] ?? item.status}</StatusBadge>{item.currentStep ? <small>Bước {item.currentStep}</small> : null}</span>
            <time className="approval-queue__when" dateTime={item.status === "pending" ? item.submittedAt : item.completedAt ?? item.submittedAt} data-label={view === "pending" ? "Thời gian chờ" : "Ngày xử lý"}>{item.status === "pending" ? waitLabel(item.waitingHours) : new Intl.DateTimeFormat("vi-VN").format(new Date(item.completedAt ?? item.submittedAt))}</time>
          </button>)}
        </div>
      </WorkCanvas>
      {selected ? <Inspector className="approval-queue__inspector" title="Chi tiết yêu cầu">
        <div className="approval-inspector-heading"><span>{domainLabels[selected.domainType] ?? selected.domainType}</span><strong>{selected.summary}</strong><StatusBadge tone={selected.status === "approved" ? "success" : selected.status === "rejected" ? "error" : "warning"}>{statusLabels[selected.status] ?? selected.status}</StatusBadge></div>
        <dl className="approval-inspector-fields">{hasValue(selected.requesterName) ? <div><dt>Người gửi</dt><dd>{selected.requesterName}</dd></div> : null}{hasValue(selected.organizationName) ? <div><dt>Đơn vị</dt><dd>{selected.organizationName}</dd></div> : null}<div><dt>{selected.status === "pending" ? "Thời gian chờ" : "Ngày xử lý"}</dt><dd>{selected.status === "pending" ? waitLabel(selected.waitingHours) : new Intl.DateTimeFormat("vi-VN").format(new Date(selected.completedAt ?? selected.submittedAt))}</dd></div>{selected.currentStep ? <div><dt>Bước hiện tại</dt><dd>{selected.currentStep}</dd></div> : null}</dl>
        <div className="approval-inspector-actions"><Link className="button button--primary button--md" href={`/approvals/${selected.id}`}>Mở yêu cầu</Link><Button onClick={() => setSelected(undefined)}>Đóng</Button></div>
      </Inspector> : null}
    </WorkbenchLayout>
  );
}
