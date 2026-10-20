"use client";

import { FileDownloadLink } from "@/components/shared/FileDownloadLink";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Textarea } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { ErrorState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { LeaveApprovalStep, LeaveRequest } from "../types/leaveTypes";
import { formatBusinessDate } from "@/lib/time/timezone";
import { can } from "@/lib/auth/permissions";
import { approverSourceLabels, formatLeaveDays, isAwaitingLeave, leaveDateLabel, leaveStatusLabels } from "./leavePresentation";
import styles from "./LeaveRequestDetail.module.css";

type Decision = "approve" | "reject" | "withdraw" | "cancel";
const decisionLabels: Record<Decision, string> = { approve: "Duyệt đơn nghỉ", reject: "Từ chối đơn nghỉ", withdraw: "Thu hồi đơn nghỉ", cancel: "Hủy đơn đã duyệt" };
const stepStatusLabels: Record<LeaveApprovalStep["status"], string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", skipped: "Bỏ qua", cancelled: "Đã hủy" };
const hasValue = (value?: string) => Boolean(value?.trim() && !["—", "-"].includes(value.trim()));

export function LeaveRequestDetail({ id, scope = "all" }: { id: string; scope?: "self" | "all" }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [item, setItem] = useState<LeaveRequest>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [decision, setDecision] = useState<Decision>();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const mutationRef = useRef(false);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/v1/leave-requests/${id}${scope === "self" ? "?scope=self" : ""}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      const body = await response.json();
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải đơn nghỉ.");
      if (!controller.signal.aborted) setItem(body.data);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể tải đơn nghỉ.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [id, scope]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; requestRef.current?.abort(); };
  }, [load]);

  async function action(name: Decision | "submit") {
    if (!item || mutationRef.current) return;
    mutationRef.current = true; setBusy(true); setActionError("");
    try {
      const response = await fetch(`/api/v1/leave-requests/${id}/${name}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: item.version, ...(name === "cancel" ? { reason: comment.trim() } : name === "approve" || name === "reject" ? { comment: comment.trim() } : {}) }),
        signal: AbortSignal.timeout(20_000)
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể xử lý đơn nghỉ.");
      setItem(body.data); setDecision(undefined); setComment(""); router.refresh();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Không thể xử lý đơn nghỉ."); }
    finally { mutationRef.current = false; setBusy(false); }
  }
  function chooseDecision(value: Decision) { setComment(""); setActionError(""); setDecision(value); }

  if (error) return <ErrorState title="Không thể tải đơn nghỉ" description={error} action={<Button onClick={() => void load()}>Thử lại</Button>} />;
  if (loading || !item) return <LoadingState title="Đang tải đơn nghỉ" />;
  const pending = isAwaitingLeave(item);
  const pendingStep = item.approvalSteps.find(step => step.status === "pending");
  const canApprove = item.availableActions?.approve ?? (pending && Boolean(pendingStep) && (can(user.permissions, "leave.approve_all") || can(user.permissions, "leave.approve") && pendingStep?.approverAccountId === user.id));
  const reasonRequired = decision === "reject" || decision === "cancel";

  return <div className={`leave-detail-grid ${styles.layout}`}>
    <Card className={styles.requestCard}>
      <div className={styles.heading}><h2>{item.leaveTypeName}</h2><StatusBadge status={item.status}>{leaveStatusLabels[item.status]}</StatusBadge></div>
      <dl className={styles.facts}>
        <div><dt>Mã đơn</dt><dd>{item.requestNumber}</dd></div>
        <div><dt>Nhân viên</dt><dd>{item.employeeName}{hasValue(item.employeeCode) ? <span className={styles.factSub}>{item.employeeCode}</span> : null}</dd></div>
        {hasValue(item.departmentName) ? <div><dt>Phòng ban</dt><dd>{item.departmentName}</dd></div> : null}
        {hasValue(item.positionName) ? <div><dt>Chức vụ</dt><dd>{item.positionName}</dd></div> : null}
        <div className={styles.period}><dt>Thời gian nghỉ</dt><dd><strong>{leaveDateLabel(item)}</strong><span>{formatLeaveDays(item.calculatedDays)} ngày</span></dd></div>
        <div><dt>Số dư phép</dt><dd>{item.deductsBalance ? "Có trừ phép" : "Không trừ phép"}</dd></div>
        {item.submittedAt ? <div><dt>Ngày gửi</dt><dd>{formatBusinessDate(item.submittedAt)}</dd></div> : null}
        {item.approvedAt ? <div><dt>Ngày duyệt</dt><dd>{formatBusinessDate(item.approvedAt)}</dd></div> : null}
        {item.cancelledAt ? <div><dt>Ngày hủy</dt><dd>{formatBusinessDate(item.cancelledAt)}</dd></div> : null}
        {hasValue(item.reason) ? <div className={styles.reason}><dt>Lý do</dt><dd>{item.reason}</dd></div> : null}
      </dl>
      {item.warnings.map(value => <p className="form-warning" key={value}>{value}</p>)}
      {item.attachments.length ? <div className={styles.attachments}><h3>Tài liệu</h3>{item.attachments.map(file => <a href={`/api/v1/leave-requests/${id}/attachments/${file.id}`} key={file.id} rel="noreferrer" target="_blank">{file.fileName}</a>)}</div> : null}
      <div className={styles.actions}>
        {item.availableActions?.exportPdf ? <FileDownloadLink format="pdf" className="button button--secondary button--md" href={`/api/v1/leave-requests/${id}/pdf`}>Xuất PDF</FileDownloadLink> : null}
        {item.availableActions?.edit ? <Link className="button button--secondary button--md" href={`/leave/requests/${id}/edit`}>Sửa đơn nháp</Link> : null}
        {item.availableActions?.submit ? <Button disabled={busy} busy={busy} onClick={() => void action("submit")} variant="primary">Gửi duyệt</Button> : null}
        {item.availableActions?.withdraw ? <Button disabled={busy} onClick={() => chooseDecision("withdraw")}>Thu hồi</Button> : null}
        {item.availableActions?.cancel ? <Button disabled={busy} onClick={() => chooseDecision("cancel")} variant="danger">Hủy đơn</Button> : null}
      </div>
      {actionError && !decision ? <p className="form-error" role="alert">{actionError}</p> : null}
    </Card>
    {item.approvalSteps.length ? <Card className={styles.approvalCard}>
      <h2>Tiến trình duyệt</h2>
      <ol className={styles.timeline}>
        {item.approvalSteps.map(step => <li key={step.id}>
          <div className={styles.stepIdentity}><span>Bước {step.stepOrder} · {approverSourceLabels[step.approverSource] || step.approverSource}</span><strong>{step.approverName || "Chưa xác định người duyệt"}</strong>{step.actedAt ? <span>{formatBusinessDate(step.actedAt)}</span> : null}</div>
          <StatusBadge tone={step.status === "approved" ? "success" : step.status === "rejected" ? "error" : step.status === "pending" && step.id === pendingStep?.id && pending ? "warning" : "neutral"}>{step.status === "pending" && step.id !== pendingStep?.id ? "Chưa đến bước" : stepStatusLabels[step.status]}</StatusBadge>
          {step.comment ? <span className={styles.stepComment}>{step.comment}</span> : null}
        </li>)}
      </ol>
      {pending && canApprove ? <div className={styles.decision}><div className={styles.actions}><Button disabled={busy} onClick={() => chooseDecision("reject")} variant="danger">Từ chối</Button><Button disabled={busy} onClick={() => chooseDecision("approve")} variant="primary">Duyệt</Button></div></div> : null}
    </Card> : null}
    <Modal open={Boolean(decision)} title={decision ? decisionLabels[decision] : "Xác nhận"} onClose={() => { if (!busy) { setDecision(undefined); setActionError(""); } }}>
      {decision ? <form className={styles.confirm} onSubmit={event => { event.preventDefault(); void action(decision); }}>
        <dl><div><dt>Nhân viên</dt><dd>{item.employeeName}</dd></div><div><dt>Đơn nghỉ</dt><dd>{item.requestNumber}</dd></div><div><dt>Thời gian</dt><dd>{leaveDateLabel(item)} · {formatLeaveDays(item.calculatedDays)} ngày</dd></div></dl>
        {decision !== "withdraw" ? <Textarea label={reasonRequired ? "Lý do" : "Ý kiến"} required={reasonRequired} minLength={reasonRequired ? 3 : undefined} maxLength={1000} rows={3} disabled={busy} value={comment} onChange={event => setComment(event.target.value)} /> : null}
        {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
        <div className={styles.actions}><Button disabled={busy} type="button" onClick={() => setDecision(undefined)}>Quay lại</Button><Button busy={busy} disabled={busy || reasonRequired && comment.trim().length < 3} variant={decision === "approve" ? "primary" : "danger"} type="submit">{decisionLabels[decision]}</Button></div>
      </form> : null}
    </Modal>
  </div>;
}
