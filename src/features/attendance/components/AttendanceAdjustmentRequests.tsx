"use client";

import { CalendarDays, Check, ClipboardList, Clock3, Plus, Send, X } from "lucide-react";
import { Input, Select, Textarea } from "@/components/shared/FormControls";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Overlays";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AttendanceAdjustmentRequest } from "@/features/attendance/services/adjustmentRequestService";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import styles from "./AttendanceAdjustmentRequests.module.css";

const requestLabels = { missing_check_in: "Quên chấm vào", missing_check_out: "Quên chấm ra" } as const;
const statusLabels = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" } as const;

export function AttendanceAdjustmentRequests({ scope = "self", canReview = false, initialDate }: { scope?: "self" | "all"; canReview?: boolean; initialDate?: string }) {
  const [items, setItems] = useState<AttendanceAdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(Boolean(initialDate));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rejectItem, setRejectItem] = useState<AttendanceAdjustmentRequest>();
  const [rejectionNote, setRejectionNote] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/attendance/adjustment-requests?scope=${scope}`, { cache: "no-store" });
    const body = await response.json() as { data?: AttendanceAdjustmentRequest[]; error?: { message: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải yêu cầu.");
    setItems(body.data);
    setError("");
    setLoading(false);
  }, [scope]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : "Không thể tải yêu cầu."); setLoading(false); }), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useDomainReconciliation("attendance", load);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/attendance/adjustment-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendanceDate: form.get("attendanceDate"), requestType: form.get("requestType"), requestedTime: form.get("requestedTime"), reason: form.get("reason") }) });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể gửi yêu cầu.");
      setMessage("Đã gửi yêu cầu điều chỉnh công.");
      setShowForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu.");
    } finally { setBusy(false); }
  }

  async function review(id: string, approve: boolean, note = "") {
    if (!approve && !note.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/attendance/adjustment-requests/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve, note }) });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể xử lý yêu cầu.");
      setMessage(approve ? "Đã duyệt và bổ sung lượt chấm công." : "Đã từ chối yêu cầu.");
      setRejectItem(undefined);
      setRejectionNote("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu.");
    } finally { setBusy(false); }
  }

  return <>
    <Card className={styles.card} padding="none">
      <header className={styles.header}><div className={styles.heading}><span aria-hidden="true" className={styles.headingIcon}><ClipboardList size={21} /></span><h2>{scope === "self" ? "Điều chỉnh công" : "Yêu cầu điều chỉnh công"}</h2>{!loading ? <span className={styles.count}>{items.length}</span> : null}</div>{scope === "self" ? <Button aria-expanded={showForm} busy={busy} leftIcon={showForm ? <X aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />} onClick={() => setShowForm((value) => !value)} size="sm" variant={showForm ? "secondary" : "primary"}>{showForm ? "Đóng" : "Tạo yêu cầu"}</Button> : null}</header>
      {showForm && scope === "self" ? <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Input defaultValue={initialDate} label="Ngày công" name="attendanceDate" required type="date" />
        <Select label="Loại yêu cầu" name="requestType" options={[{ label: "Quên chấm ra", value: "missing_check_out" }, { label: "Quên chấm vào", value: "missing_check_in" }]} />
        <Input label="Giờ đề nghị" name="requestedTime" required type="time" />
        <div className={styles.reasonField}><Textarea label="Lý do" minLength={5} name="reason" required rows={3} /></div>
        <footer className={styles.formActions}><Button disabled={busy} onClick={() => setShowForm(false)}>Hủy</Button><Button busy={busy} leftIcon={<Send aria-hidden="true" size={16} />} type="submit" variant="primary">Gửi yêu cầu</Button></footer>
      </form> : null}
      {error && !rejectItem ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.success} role="status"><Check aria-hidden="true" size={16} />{message}</p> : null}
      {loading ? <LoadingState className={styles.state} title="Đang tải yêu cầu" /> : items.length ? <div className={styles.list}>{items.map((item) => <article className={styles.item} data-status={item.status} key={item.id}>
        <div className={styles.itemMain}><div className={styles.itemHeading}><strong>{scope === "all" && item.employeeName !== "—" ? item.employeeName : requestLabels[item.requestType]}</strong><StatusBadge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "error" : "warning"}>{statusLabels[item.status]}</StatusBadge></div>
          <div className={styles.meta}>{scope === "all" ? <span className={styles.requestType}>{requestLabels[item.requestType]}</span> : null}<span><CalendarDays aria-hidden="true" size={14} />{item.attendanceDate.split("-").reverse().join("/")}</span><span><Clock3 aria-hidden="true" size={14} /><strong>{item.requestedTime}</strong></span>{scope === "all" && item.employeeCode !== "—" ? <span className={styles.employeeCode}>{item.employeeCode}</span> : null}</div>
          <p className={styles.reason}>{item.reason}</p>{item.reviewNote ? <p className={styles.reviewNote}><span>Phản hồi</span>{item.reviewNote}</p> : null}
        </div>
        {scope === "all" && canReview && item.status === "pending" ? <div className={styles.itemActions}><Button busy={busy} leftIcon={<Check aria-hidden="true" size={15} />} onClick={() => void review(item.id, true)} size="sm" variant="primary">Duyệt</Button><Button disabled={busy} onClick={() => { setRejectItem(item); setRejectionNote(""); setError(""); setMessage(""); }} size="sm">Từ chối</Button></div> : null}
      </article>)}</div> : <EmptyState className={styles.state} title="Chưa có yêu cầu điều chỉnh công" />}
    </Card>
    <Modal className={styles.rejectDialog} onClose={() => { if (!busy) { setRejectItem(undefined); setRejectionNote(""); } }} open={Boolean(rejectItem)} title="Từ chối yêu cầu">
      {rejectItem ? <form className={styles.rejectForm} onSubmit={(event) => { event.preventDefault(); void review(rejectItem.id, false, rejectionNote); }}><div className={styles.rejectSummary}><strong>{rejectItem.employeeName}</strong><span>{requestLabels[rejectItem.requestType]} · {rejectItem.attendanceDate.split("-").reverse().join("/")} · {rejectItem.requestedTime}</span></div><Textarea disabled={busy} label="Lý do từ chối" onChange={(event) => setRejectionNote(event.target.value)} required rows={4} value={rejectionNote} />{error ? <p className={styles.dialogError} role="alert">{error}</p> : null}<footer className={styles.dialogActions}><Button disabled={busy} onClick={() => { setRejectItem(undefined); setRejectionNote(""); }}>Hủy</Button><Button busy={busy} disabled={!rejectionNote.trim()} type="submit" variant="danger">Từ chối yêu cầu</Button></footer></form> : null}
    </Modal>
  </>;
}
