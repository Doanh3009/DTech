"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import { warehouseRequest } from "./warehouseClient";

export function useWarehouseResource<T>(url: string) {
  const sequence = useRef(0);
  const [result, setResult] = useState<{ url: string; data?: T; error?: string }>({ url });
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++sequence.current;
    try {
      const data = await warehouseRequest<T>(url, { signal });
      if (request === sequence.current && !signal?.aborted) setResult({ url, data });
    } catch (caught) {
      if (request === sequence.current && !signal?.aborted) setResult(current => ({ ...(current.url === url ? current : {}), url, error: caught instanceof Error ? caught.message : "Không thể tải dữ liệu kho." }));
    }
  }, [url]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); }; }, [load]);
  const reconcile = useCallback(() => load(), [load]);
  useDomainReconciliation("warehouse", reconcile);
  const current = result.url === url ? result : undefined;
  return { data: current?.data, error: current?.error, loading: !current?.data && !current?.error, reload: reconcile };
}

export function warehouseUrl(path: string, values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") query.set(key, String(value));
  return query.size ? `${path}?${query}` : path;
}
export const warehouseSearchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi");
