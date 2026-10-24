"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Overlays";
import { notifyAccountOperationsChanged } from "@/features/employees/components/useAccountProvisionCommand";

export function DeleteUserAccountButton({ accountId, accountName }: { accountId: string; accountName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);

  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    requestId.current ??= crypto.randomUUID();
    setPending(true);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/accounts/${encodeURIComponent(accountId)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current }), signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (response.status === 400) { requestId.current = null; setPending(false); }
        setError(body.error?.message ?? "Chưa thể xác nhận kết quả xóa. Vui lòng thử lại.");
        return;
      }
      if (body.data?.requestId !== requestId.current || body.data?.accountId !== accountId
        || body.data?.kind !== "delete" || body.data?.state !== "completed") throw new Error("Unconfirmed deletion receipt");
      requestId.current = null;
      setPending(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Chưa thể xác nhận kết quả xóa. Vui lòng thử lại.");
    } finally {
      notifyAccountOperationsChanged();
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button leftIcon={<Trash2 aria-hidden="true" size={15} />} onClick={() => setOpen(true)} size="sm" variant="danger">
        Xóa
      </Button>
      <Modal
        className="modal--confirm"
        onClose={() => { if (!inFlight.current) setOpen(false); }}
        open={open}
        title="Xóa tài khoản đăng nhập"
      >
        <div className="overlay-form">
          <strong>{accountName}</strong>
          {error ? <p className="form-alert form-alert--error" role="alert">{error}</p> : null}
          <footer>
            <Button disabled={busy} onClick={() => setOpen(false)}>Hủy</Button>
            <Button busy={busy} disabled={busy} onClick={() => void remove()} variant="danger">{pending ? "Thử lại" : "Xóa tài khoản"}</Button>
          </footer>
        </div>
      </Modal>
    </>
  );
}
