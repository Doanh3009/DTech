"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AppNotification } from "@/features/shared-platforms/types";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";

function group(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  return days < 1 ? "Hôm nay" : days < 7 ? "Gần đây" : "Trước đó";
}

function isAttendanceNotification(item: AppNotification) {
  return /^(attendance|leave|timesheet|shift)\./.test(item.eventKey) ||
    ["attendance_event", "leave_request", "timesheet_adjustment", "shift_assignment"].includes(item.entityType ?? "");
}

export function NotificationCenter({ unreadOnly = false, attendanceOnly = false }: { unreadOnly?: boolean; attendanceOnly?: boolean }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/notifications${unreadOnly ? "?unread=true" : ""}`);
      const body = await response.json() as { data?: AppNotification[]; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải thông báo.");
      setItems(attendanceOnly ? (body.data ?? []).filter(isAttendanceNotification) : body.data ?? []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  }, [attendanceOnly, unreadOnly]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  useDomainReconciliation("notifications", load);

  async function read(id: string) {
    await fetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
    setItems((current) => unreadOnly ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  async function readAll() {
    if (attendanceOnly) {
      await Promise.all(items.filter((item) => !item.readAt).map((item) => fetch(`/api/v1/notifications/${item.id}/read`, { method: "POST" })));
    } else {
      await fetch("/api/v1/notifications/read-all", { method: "POST" });
    }
    await load();
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState description={error} />;
  return <Card className="notification-center">
    <div className="panel-header"><h2>{attendanceOnly ? "Chấm công của tôi" : unreadOnly ? "Chưa đọc" : "Tất cả thông báo"}</h2>{items.some((item) => !item.readAt) ? <Button leftIcon={<CheckCheck size={16} />} onClick={() => void readAll()}>Đánh dấu tất cả đã đọc</Button> : null}</div>
    {items.length ? <div className="notification-groups">{[...new Set(items.map((item) => group(item.createdAt)))].map((section) => <section key={section}>
      <h3>{section}</h3><div className="notification-list">{items.filter((item) => group(item.createdAt) === section).map((item) => <article className={`notification-item ${item.readAt ? "" : "is-unread"}`} key={item.id}>
        <span className="notification-item__dot" /><span className="notification-item__icon"><Bell size={18} /></span>
        <div className="notification-item__body"><h3>{item.title}</h3><p>{item.message}</p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("vi-VN", { timeStyle: "short", dateStyle: "short" }).format(new Date(item.createdAt))}</time></div>
        <StatusBadge tone={item.priority === "critical" ? "error" : item.priority === "important" ? "warning" : "neutral"}>{item.priority}</StatusBadge>
        <div className="notification-item__actions">{!item.readAt ? <Button size="sm" onClick={() => void read(item.id)}>Đã đọc</Button> : null}{item.deepLink ? <Link className="button button--ghost button--sm" href={item.deepLink} onClick={() => void read(item.id)}>Mở</Link> : null}</div>
      </article>)}</div>
    </section>)}</div> : <EmptyState title="Chưa có thông báo" />}
  </Card>;
}
