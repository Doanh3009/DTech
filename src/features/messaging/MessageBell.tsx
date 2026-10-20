"use client";

/* eslint-disable react-hooks/set-state-in-effect -- unread count is loaded asynchronously from the API. */

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getAuthenticatedSupabaseRealtimeClient } from "@/lib/supabase/client";

export function MessageBell() {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/chat/unread", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setCount(body.data?.count ?? 0);
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void load();
    void getAuthenticatedSupabaseRealtimeClient().then((client) => {
      if (!client || disposed) return;
      const channel = client.channel("chat-unread")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void load())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "message_reads" }, () => void load())
        .subscribe();
      cleanup = () => { void client.removeChannel(channel); };
      if (disposed) cleanup();
    }).catch(() => undefined);
    return () => { disposed = true; cleanup(); };
  }, [load]);

  return <Link aria-label={count ? `${count} tin nhắn chưa đọc` : "Tin nhắn"} className="icon-link notification-bell message-bell" href="/messages" title="Tin nhắn"><MessageCircle aria-hidden="true" size={18}/>{count ? <span>{count > 99 ? "99+" : count}</span> : null}</Link>;
}
