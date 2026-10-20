"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { subscribeScopedRealtime } from "@/lib/realtime/scopedSubscription";

export function NotificationBell({ accountId }: { accountId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/v1/notifications/unread-count", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as { data?: { count: number } };
        if (active) setCount(body.data?.count ?? 0);
      } catch {
        // The realtime lifecycle will reconcile when connectivity returns.
      }
    }
    void load();
    const unsubscribe = subscribeScopedRealtime({
      domain: "notifications",
      scope: `notifications-${accountId}`,
      table: "notifications",
      filter: `recipient_account_id=eq.${accountId}`,
      onInvalidate: () => void load()
    });
    return () => { active = false; unsubscribe(); };
  }, [accountId]);

  return <Link aria-label={count ? `${count} thông báo chưa đọc` : "Thông báo"} className="icon-link notification-bell" href="/notifications" title="Thông báo"><Bell aria-hidden="true" size={18} />{count ? <span>{count > 99 ? "99+" : count}</span> : null}</Link>;
}
