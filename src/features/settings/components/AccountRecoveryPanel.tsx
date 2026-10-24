"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { PasswordInput } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { accountOperationsChanged, notifyAccountOperationsChanged } from "@/features/employees/components/useAccountProvisionCommand";
import styles from "./AccountRecoveryPanel.module.css";

const operationSchema = z.object({
  requestId: z.string().uuid(), kind: z.enum(["provision", "delete"]), state: z.enum(["prepared", "cleanup_required"]),
  accountId: z.string().uuid(), employeeId: z.string().uuid().nullable(), username: z.string(),
  credentialMode: z.enum(["generated", "provided"]).nullable().optional(), createdAt: z.string()
});
type Operation = z.infer<typeof operationSchema>;
type Selection = { operation: Operation; action: "resume" | "cancel" };
const stateLabels = { prepared: "Chờ hoàn tất", cleanup_required: "Chờ thu hồi" };

export function AccountRecoveryPanel({ canCreate, canDelete, employeeId, hideWhenEmpty = false }: { canCreate: boolean; canDelete: boolean; employeeId?: string; hideWhenEmpty?: boolean }) {
  const router = useRouter();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [password, setPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryRequired, setRetryRequired] = useState(false);
  const inFlight = useRef(false);
  const pendingBody = useRef<string | null>(null);
  const listRequest = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    try {
      const response = await fetch("/api/v1/account-operations", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
      const body = await response.json();
      const parsed = z.array(operationSchema).safeParse(body.data?.operations);
      if (!response.ok || body.ok !== true || !parsed.success) throw new Error("Unavailable operation list");
      if (!controller.signal.aborted) setOperations(parsed.data
        .filter((operation) => operation.kind === "provision" ? canCreate : canDelete)
        .filter((operation) => !employeeId || operation.employeeId === employeeId));
    } catch {
      if (!controller.signal.aborted) { setListError("Không thể tải yêu cầu tài khoản."); setOperations([]); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [canCreate, canDelete, employeeId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const refresh = () => { setLoading(true); setListError(null); void load(); };
    window.addEventListener(accountOperationsChanged, refresh);
    return () => { active = false; listRequest.current?.abort(); window.removeEventListener(accountOperationsChanged, refresh); };
  }, [load]);

  function open(operation: Operation, action: "resume" | "cancel") {
    if (inFlight.current) return;
    setSelected({ operation, action }); setPassword(""); setTemporaryPassword(""); setCopied(false); setError(null); setRetryRequired(false); pendingBody.current = null;
  }
  function close() {
    if (inFlight.current) return;
    setSelected(null); setPassword(""); setTemporaryPassword(""); setCopied(false); setError(null); setRetryRequired(false); pendingBody.current = null;
  }
  const needsPassword = selected?.operation.kind === "provision" && selected.action === "resume"
    && selected.operation.state === "prepared" && selected.operation.credentialMode === "provided";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || inFlight.current) return;
    if (!pendingBody.current && needsPassword && !password) { setError("Cần nhập mật khẩu ban đầu."); return; }
    pendingBody.current ??= JSON.stringify({ action: selected.action, ...(needsPassword ? { password } : {}) });
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/v1/account-operations/${selected.operation.requestId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: pendingBody.current, signal: AbortSignal.timeout(30_000)
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) {
        if (response.status === 400) { pendingBody.current = null; setRetryRequired(false); }
        else setRetryRequired(true);
        setError(body.error?.message ?? "Chưa thể xác nhận kết quả. Vui lòng thử lại.");
        return;
      }
      const receipt = body.data;
      const expectedState = selected.operation.kind === "provision"
        && (selected.action === "cancel" || selected.operation.state === "cleanup_required") ? "cancelled" : "completed";
      if (receipt?.requestId !== selected.operation.requestId || receipt?.accountId !== selected.operation.accountId
        || receipt?.employeeId !== selected.operation.employeeId || receipt?.kind !== selected.operation.kind
        || receipt?.state !== expectedState
        || (receipt.temporaryPassword !== undefined && typeof receipt.temporaryPassword !== "string")) throw new Error("Unconfirmed recovery receipt");
      setPassword(""); pendingBody.current = null; setRetryRequired(false);
      if (receipt.temporaryPassword) setTemporaryPassword(receipt.temporaryPassword);
      else setSelected(null);
      notifyAccountOperationsChanged({ requestId: receipt.requestId, state: receipt.state, kind: receipt.kind, employeeId: receipt.employeeId }); router.refresh();
    } catch { setRetryRequired(true); setError("Chưa thể xác nhận kết quả. Vui lòng thử lại."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(temporaryPassword); setCopied(true); setError(null); }
    catch { setCopied(false); setError("Không thể sao chép. Vui lòng chọn và sao chép mật khẩu."); }
  }

  const columns: DataTableColumn<Operation>[] = [
    { id: "username", header: "Tài khoản", accessor: "username" },
    { id: "kind", header: "Yêu cầu", cell: (operation) => operation.kind === "provision" ? "Cấp tài khoản" : "Xóa tài khoản" },
    { id: "state", header: "Trạng thái", cell: (operation) => <StatusBadge tone="warning">{stateLabels[operation.state]}</StatusBadge> },
    { id: "requestId", header: "Mã yêu cầu", cell: (operation) => <code className={styles.requestId} title={operation.requestId}>{operation.requestId}</code> }
  ];
  const renderActions = (operation: Operation) => <div className={styles.actions}>
      <Button disabled={busy} onClick={() => open(operation, "resume")} size="sm">{operation.state === "cleanup_required" ? "Hoàn tất thu hồi" : "Tiếp tục"}</Button>
      {operation.kind === "provision" && operation.state === "prepared" ? <Button disabled={busy} onClick={() => open(operation, "cancel")} size="sm" variant="danger">Hủy yêu cầu</Button> : null}
    </div>;

  if (hideWhenEmpty && !loading && !listError && operations.length === 0 && !selected) return null;

  return <>
    <Card>
      <header className="panel-header"><h2>Yêu cầu tài khoản</h2><Button disabled={loading} onClick={() => { setLoading(true); setListError(null); void load(); }} size="sm">Làm mới</Button></header>
      {listError ? <div className="form-alert form-alert--error" role="alert">{listError}</div> : loading ? <div role="status">Đang tải</div> : <DataTable actions={renderActions} ariaLabel="Yêu cầu tài khoản" className={styles.recoveryTable} columns={columns} data={operations} emptyTitle="Không có yêu cầu đang chờ" getRowId={(operation) => operation.requestId} />}
    </Card>
    <Modal open={selected !== null} title={temporaryPassword ? "Tài khoản đã được tạo" : selected?.action === "cancel" ? "Hủy yêu cầu" : selected?.operation.state === "cleanup_required" ? "Hoàn tất thu hồi" : "Tiếp tục yêu cầu"} onClose={close}>
      {temporaryPassword ? <div className="overlay-form secret-once"><h3>Mật khẩu tạm thời</h3><code>{temporaryPassword}</code>{error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}<Button onClick={() => void copy()}>{copied ? "Đã sao chép" : "Sao chép"}</Button><footer><Button onClick={close} variant="primary">Hoàn tất</Button></footer></div> : <form className="overlay-form" onSubmit={submit}>
        <strong>{selected?.operation.username}</strong>
        {needsPassword ? <PasswordInput autoComplete="off" disabled={busy || retryRequired} label="Mật khẩu ban đầu" onChange={(event) => setPassword(event.target.value)} required value={password} /> : null}
        {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
        <footer><Button disabled={busy} onClick={close}>Đóng</Button><Button busy={busy} disabled={busy} type="submit" variant={selected?.action === "cancel" ? "danger" : "primary"}>{retryRequired ? "Thử lại" : selected?.action === "cancel" ? "Hủy yêu cầu" : "Tiếp tục"}</Button></footer>
      </form>}
    </Modal>
  </>;
}
