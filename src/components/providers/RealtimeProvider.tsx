"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import {
  getRealtimeConnectionState,
  getServerRealtimeConnectionState,
  startRealtimeCoordinator,
  isRealtimeDomain,
  subscribeRealtimeConnection
} from "@/lib/realtime/coordinator";
import { refreshSupabaseRealtimeAuthentication } from "@/lib/supabase/client";
import { subscribeScopedRealtime } from "@/lib/realtime/scopedSubscription";

export function RealtimeProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  useEffect(() => startRealtimeCoordinator(accountId), [accountId]);
  useEffect(() => {
    const refresh = () => { void refreshSupabaseRealtimeAuthentication(); };
    refresh();
    const timer = window.setInterval(refresh, 45 * 60_000);
    window.addEventListener("online", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("online", refresh); };
  }, [accountId]);
  useEffect(() => subscribeScopedRealtime({
    domain: "dashboard",
    scope: `invalidations-${accountId}`,
    table: "realtime_invalidations",
    filter: "audience=eq.authenticated",
    onInvalidate: () => undefined,
    resolveEvent: (payload) => {
      const row = payload.new ?? payload.old;
      const domain = row?.domain;
      const key = row?.event_key ?? row?.id;
      return isRealtimeDomain(domain) && typeof key === "string" ? { domain, key } : null;
    }
  }), [accountId]);
  return children;
}

export function useRealtimeConnectionState() {
  return useSyncExternalStore(subscribeRealtimeConnection, getRealtimeConnectionState, getServerRealtimeConnectionState);
}
