"use client";

import { useEffect, useRef } from "react";

import { subscribeRealtimeDomain, type RealtimeDomain } from "@/lib/realtime/coordinator";
import { errorFingerprint, logger } from "@/lib/logger";

const RECONCILIATION_BATCH_MS = 150;

export function useDomainReconciliation(domain: RealtimeDomain, reconcile: () => unknown | Promise<unknown>): void {
  const latest = useRef(reconcile);
  useEffect(() => { latest.current = reconcile; }, [reconcile]);
  useEffect(() => {
    let mounted = true;
    let running = false;
    let pending = false;
    let timer: number | undefined;

    function schedule() {
      pending = true;
      if (!mounted || running || timer !== undefined || document.visibilityState === "hidden") return;
      // A fixed batch window bounds latency during a continuous event stream.
      timer = window.setTimeout(() => { timer = undefined; void run(); }, RECONCILIATION_BATCH_MS);
    }

    async function run() {
      if (!mounted || document.visibilityState === "hidden") return;
      pending = false;
      running = true;
      try {
        await latest.current();
      } catch (error) {
        if (mounted) logger.warn("realtime.reconciliation_failed", {
          metadata: { domain, fingerprint: errorFingerprint(error) }
        });
      } finally {
        running = false;
        if (mounted && pending) schedule();
      }
    }

    const resume = () => {
      if (pending && document.visibilityState === "visible") schedule();
    };
    const unsubscribe = subscribeRealtimeDomain(domain, schedule);
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted = false;
      pending = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      unsubscribe();
    };
  }, [domain]);
}
