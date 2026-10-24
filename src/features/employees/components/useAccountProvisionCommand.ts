"use client";

import { useEffect, useRef, useState } from "react";
import { provisionAccountSchema, type ProvisionAccountInput } from "@/features/employees/schemas/employeeSchemas";

export interface ProvisionReceipt {
  requestId: string;
  accountId: string;
  employeeId: string;
  kind: "provision";
  state: "completed";
  temporaryPassword?: string;
}
export interface PendingProvision {
  employeeId: string;
  input: ProvisionAccountInput;
  body: string;
}
export const accountOperationsChanged = "dtech:account-operations-changed";
export function notifyAccountOperationsChanged(receipt?: { requestId: string; state: string; kind: "provision" | "delete"; employeeId: string | null }) {
  window.dispatchEvent(new CustomEvent(accountOperationsChanged, { detail: receipt }));
}

/** Credentials and the immutable retry body live only in this mounted component. */
export function useAccountProvisionCommand() {
  const [pending, setPending] = useState<PendingProvision | null>(null);
  const pendingRef = useRef<PendingProvision | null>(null);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reconcile = (event: Event) => {
      const receipt = (event as CustomEvent<{ requestId?: string; state?: string; kind?: string; employeeId?: string | null }>).detail;
      if (receipt?.kind === "provision" && receipt.employeeId === pendingRef.current?.employeeId
        && receipt.requestId === pendingRef.current?.input.requestId && ["completed", "cancelled"].includes(receipt.state ?? "")) {
        pendingRef.current = null;
        setPending(null);
        setError(null);
      }
    };
    window.addEventListener(accountOperationsChanged, reconcile);
    return () => { window.removeEventListener(accountOperationsChanged, reconcile); };
  }, []);

  async function send(request: PendingProvision): Promise<ProvisionReceipt | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/employees/${encodeURIComponent(request.employeeId)}/accounts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: request.body, signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (response.status === 400) { pendingRef.current = null; setPending(null); }
        setError(body.error?.message ?? "Chưa thể xác nhận kết quả. Tiếp tục yêu cầu hoặc thử lại.");
        return null;
      }
      const receipt = body.data;
      if (receipt?.requestId !== request.input.requestId || receipt?.employeeId !== request.employeeId
        || receipt?.kind !== "provision" || receipt?.state !== "completed"
        || typeof receipt?.accountId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.accountId)
        || (receipt.temporaryPassword !== undefined && typeof receipt.temporaryPassword !== "string")) {
        throw new Error("Unconfirmed provision receipt");
      }
      pendingRef.current = null;
      setPending(null);
      return receipt as ProvisionReceipt;
    } catch {
      setError("Chưa thể xác nhận kết quả. Tiếp tục yêu cầu hoặc thử lại.");
      return null;
    } finally {
      notifyAccountOperationsChanged();
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function run(employeeId: string, input: Omit<ProvisionAccountInput, "requestId">) {
    if (inFlight.current) return null;
    if (pendingRef.current) return send(pendingRef.current);
    const result = provisionAccountSchema.safeParse({ ...input, roleIds: [...input.roleIds], requestId: crypto.randomUUID() });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Thông tin cấp tài khoản chưa hợp lệ."); return null; }
    const request = { employeeId, input: result.data, body: JSON.stringify(result.data) };
    pendingRef.current = request;
    setPending(request);
    return send(request);
  }
  async function retry() { return pendingRef.current ? send(pendingRef.current) : null; }

  return { pending, error, submitting, run, retry, clearError: () => setError(null) };
}
