"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { beginLoadingActivity } from "@/lib/ui/loadingActivity";

type ApiBody<T> = { data?: T; error?: { message?: string } };

export async function requestImportExport<T>(url: string, init?: RequestInit): Promise<T> {
  const finish = beginLoadingActivity();
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    const body = await response.json() as ApiBody<T>;
    if (!response.ok || body.data === undefined) throw new Error(body.error?.message || "Không thể xử lý yêu cầu.");
    return body.data;
  } finally { finish(); }
}

export function useImportExportData<T>(url: string) {
  const [result, setResult] = useState<{ url: string; data?: T; error?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setRefreshing(true);
    try {
      const data = await requestImportExport<T>(url, { signal: request.signal });
      if (request.signal.aborted) return;
      setResult({ url, data });
      return data;
    } catch (reason) {
      if (!request.signal.aborted) setResult((current) => ({ url, data: current?.url === url ? current.data : undefined, error: reason instanceof Error ? reason.message : "Không thể tải dữ liệu." }));
    } finally {
      if (!request.signal.aborted) setRefreshing(false);
    }
  }, [url]);
  useEffect(() => {
    void reload();
    return () => controller.current?.abort();
  }, [reload]);
  useDomainReconciliation("import-export", reload);
  const current = result?.url === url ? result : undefined;
  return { data: current?.data, error: current?.error ?? "", loading: !current?.data && !current?.error, refreshing, reload };
}
