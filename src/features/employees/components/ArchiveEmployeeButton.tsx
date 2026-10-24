"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { archiveEmployeeSchema } from "@/features/employees/schemas/employeeSchemas";
import styles from "./EmployeeAuxiliary.module.css";

export function ArchiveEmployeeButton({ employeeId, rowVersion, renderTrigger }: { employeeId: string; rowVersion: number; renderTrigger?: (onOpen: () => void) => ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const inFlight = useRef(false);

  async function archive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || reloadRequired) return;
    setError(null);
    const result = archiveEmployeeSchema.safeParse({ rowVersion, reason });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Lý do chưa hợp lệ."); return; }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/employees/${encodeURIComponent(employeeId)}/archive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data), signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (response.status >= 500 || [401, 403, 409].includes(response.status)) setReloadRequired(true);
        setError(response.status >= 500 ? "Chưa xác định được kết quả lưu. Tải lại hồ sơ trước khi tiếp tục." : body.error?.message ?? "Không thể lưu trữ hồ sơ.");
        return;
      }
      if (body.data?.employeeId !== employeeId || body.data?.rowVersion !== rowVersion + 1) throw new Error("Unconfirmed command receipt");
      setReloadRequired(true);
      setOpen(false);
      router.refresh();
    } catch {
      setReloadRequired(true);
      setError("Chưa xác định được kết quả lưu. Tải lại hồ sơ trước khi tiếp tục.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      {renderTrigger ? renderTrigger(() => setOpen(true)) : <Button disabled={submitting || (reloadRequired && !error)} onClick={() => setOpen(true)}>Lưu trữ</Button>}
      <Modal className="modal--confirm" open={open} title="Lưu trữ hồ sơ" onClose={() => { if (!inFlight.current) setOpen(false); }}>
        <form className="overlay-form" onSubmit={archive}>
          {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
          <fieldset className={styles.fields} disabled={submitting || reloadRequired}>
            <legend className="sr-only">Lưu trữ hồ sơ</legend>
            <Input label="Lý do" maxLength={500} minLength={3} onChange={(event) => setReason(event.target.value)} required value={reason} />
          </fieldset>
          <footer>
            <Button disabled={submitting} onClick={() => setOpen(false)}>Hủy</Button>
            {reloadRequired ? <Button onClick={() => window.location.reload()}>Tải lại hồ sơ</Button> : null}
            <Button busy={submitting} disabled={submitting || reloadRequired} type="submit" variant="danger">Lưu trữ</Button>
          </footer>
        </form>
      </Modal>
    </>
  );
}
