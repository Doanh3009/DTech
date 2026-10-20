"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { ConfirmDialog } from "@/components/shared/Overlays";

export function DeleteUserAccountButton({ accountId, accountName }: { accountId: string; accountName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/accounts/${accountId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể xóa tài khoản.");
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button leftIcon={<Trash2 aria-hidden="true" size={15} />} onClick={() => setOpen(true)} size="sm" variant="danger">
        Xóa
      </Button>
      <ConfirmDialog
        confirmLabel={busy ? "Đang xóa…" : "Xóa tài khoản"}
        danger
        onClose={() => { if (!busy) setOpen(false); }}
        onConfirm={remove}
        open={open}
        title="Xóa tài khoản đăng nhập"
      >
        <strong>{accountName}</strong>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </ConfirmDialog>
    </>
  );
}
