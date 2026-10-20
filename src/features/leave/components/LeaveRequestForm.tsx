"use client";

import { CalendarDays, FileText, Paperclip, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, IconButton } from "@/components/shared/Button";
import { Select } from "@/components/shared/FormControls";
import { ErrorState, LoadingState } from "@/components/shared/States";
import type { LeaveBalance, LeaveDayPart, LeaveRequest, LeaveType } from "@/features/leave/types/leaveTypes";
import { getBusinessDateKey } from "@/lib/time/timezone";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import styles from "./LeaveRequestForm.module.css";

const dayParts = [{ label: "Cả ngày", value: "full_day" }, { label: "Buổi sáng", value: "morning" }, { label: "Buổi chiều", value: "afternoon" }];

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Không thể tải dữ liệu nghỉ phép.");
  return body.data as T;
}

export function LeaveRequestForm({ requestId }: { requestId?: string } = {}) {
  const today = getBusinessDateKey();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const mutationRef = useRef(false);
  const draftRef = useRef<LeaveRequest | undefined>(undefined);
  const attachedFileRef = useRef<File | undefined>(undefined);
  const [draft, setDraft] = useState<LeaveRequest>();
  const [attached, setAttached] = useState(false);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: today, endDate: today, startDayPart: "full_day" as LeaveDayPart, endDayPart: "full_day" as LeaveDayPart, reason: "" });
  const [preview, setPreview] = useState<{ key: string; days?: number; balance?: LeaveBalance; error?: string }>();
  useLoadingActivity(loading || busy);
  const { leaveTypeId, startDate, endDate, startDayPart, endDayPart } = form;
  const previewKey = JSON.stringify({ leaveTypeId, startDate, endDate, startDayPart, endDayPart });
  const estimate = preview?.key === previewKey ? preview.days : undefined;
  const selectedType = types.find(type => type.id === leaveTypeId);
  const selectedBalance = preview?.key === previewKey && preview.balance ? preview.balance : balances.find(balance => balance.leaveTypeId === leaveTypeId);
  const previewError = preview?.key === previewKey ? preview.error : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setLoadError(""); } });
    void Promise.all([
      fetch("/api/v1/leave-types", { signal, cache: "no-store" }).then(readResponse<LeaveType[]>),
      fetch(`/api/v1/leave-balances?year=${today.slice(0, 4)}`, { signal, cache: "no-store" }).then(readResponse<{ balances: LeaveBalance[] }>),
      requestId ? fetch(`/api/v1/leave-requests/${requestId}?scope=self`, { signal, cache: "no-store" }).then(readResponse<LeaveRequest>) : Promise.resolve(undefined)
    ]).then(([allTypes, balanceData, initial]) => {
      if (controller.signal.aborted) return;
      if (initial && (initial.status !== "draft" || !initial.availableActions?.edit)) throw new Error("Đơn này không còn được phép chỉnh sửa.");
      const active = allTypes.filter(type => type.active || type.id === initial?.leaveTypeId);
      setTypes(active);
      setBalances(balanceData.balances);
      if (initial) {
        draftRef.current = initial; setDraft(initial);
        setForm({ leaveTypeId: initial.leaveTypeId, startDate: initial.startDate, endDate: initial.endDate, startDayPart: initial.startDayPart, endDayPart: initial.endDayPart, reason: initial.reason });
      } else if (!active.length) setLoadError("Chưa có loại nghỉ đang hoạt động.");
    }).catch(reason => {
      if (!controller.signal.aborted) setLoadError(signal.aborted ? "Tải dữ liệu quá lâu. Vui lòng thử lại." : reason.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [today, requestId, reload]);

  useEffect(() => {
    if (!leaveTypeId || !startDate || !endDate || endDate < startDate) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    const timer = setTimeout(() => {
      void fetch("/api/v1/leave-requests/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({ ...JSON.parse(previewKey), reason: "Dự kiến" })
      }).then(readResponse<{ days: number; balance?: LeaveBalance }>).then(data => {
        if (!controller.signal.aborted) setPreview({ key: previewKey, ...data });
      }).catch(reason => {
        if (!controller.signal.aborted) setPreview({ key: previewKey, error: signal.aborted ? "Chưa tính được ngày nghỉ. Vui lòng chọn lại thời gian." : reason.message });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [previewKey, leaveTypeId, startDate, endDate]);

  function update(key: keyof typeof form, value: string) {
    setForm(current => {
      const next = { ...current, [key]: value };
      if (key === "leaveTypeId") {
        const type = types.find(item => item.id === value);
        if (!type?.allowsHalfDay) { next.startDayPart = "full_day"; next.endDayPart = "full_day"; }
        if (!type?.allowsMultiDay) next.endDate = next.startDate;
      }
      if (key === "startDate" && (value > current.endDate || !selectedType?.allowsMultiDay)) next.endDate = value;
      if (next.startDate === next.endDate) next.endDayPart = next.startDayPart;
      return next;
    });
  }

  async function save(submit: boolean) {
    if (mutationRef.current || !formRef.current?.reportValidity()) return;
    if (selectedType?.requiresReason && form.reason.trim().length < 2) { setError("Lý do cần ít nhất 2 ký tự."); return; }
    if (estimate === undefined || estimate <= 0 || previewError) { setError(previewError ?? "Vui lòng chọn ngày nghỉ hợp lệ."); return; }
    if (submit && selectedType?.requiresAttachment && !file && !draft?.attachments.length) { setError("Loại nghỉ này cần tài liệu đính kèm."); return; }
    if (file && (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024)) { setError("Chỉ nhận PDF, PNG, JPG tối đa 5 MB."); return; }
    mutationRef.current = true;
    setBusy(true);
    setError("");
    try {
      // A created draft survives attachment/submission failures without creating another request.
      let item: LeaveRequest;
      if (requestId && draftRef.current) {
        item = await fetch(`/api/v1/leave-requests/${requestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, version: draftRef.current.version }) }).then(readResponse<LeaveRequest>);
        draftRef.current = item; setDraft(item);
      } else {
        item = draftRef.current ?? await fetch("/api/v1/leave-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(readResponse<LeaveRequest>);
      }
      if (!draftRef.current) {
        draftRef.current = item;
        setDraft(item);
      }
      if (file && attachedFileRef.current !== file) {
        const data = new FormData(); data.set("file", file);
        await fetch(`/api/v1/leave-requests/${item.id}/attachments`, { method: "POST", body: data }).then(readResponse);
        attachedFileRef.current = file;
        setAttached(true);
      }
      item = await fetch(`/api/v1/leave-requests/${item.id}?scope=self`, { cache: "no-store" }).then(readResponse<LeaveRequest>);
      draftRef.current = item;
      setDraft(item);
      if (submit && item.status === "draft") await fetch(`/api/v1/leave-requests/${item.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: item.version }) }).then(readResponse);
      router.push(`/leave/requests/${item.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu đơn.");
    } finally { mutationRef.current = false; setBusy(false); }
  }

  if (loading) return <LoadingState title="Đang tải dữ liệu nghỉ phép" />;
  if (loadError) return <ErrorState title="Không thể mở đơn nghỉ" description={loadError} action={<Button onClick={() => setReload(value => value + 1)}>Thử lại</Button>} />;
  return <form className={`leave-form ${styles.form}`} ref={formRef} onSubmit={event => { event.preventDefault(); void save(true); }}>
    <fieldset disabled={loading || busy || Boolean(draft) && !requestId} className={styles.section}>
      <legend className="sr-only">Thời gian nghỉ</legend>
      <h2><span className={styles.sectionIcon}><CalendarDays size={21} /></span>Thời gian nghỉ</h2>
      <Select label="Loại nghỉ" placeholder="Chọn loại nghỉ" required value={form.leaveTypeId} onChange={event => update("leaveTypeId", event.target.value)} options={types.map(type => ({ label: `${type.name} · ${type.code}${type.active ? "" : " · Tắt"}`, value: type.id }))} />
      <div className={styles.dateRow}>
        <label className={styles.date}><span>Từ ngày</span><input type="date" required value={form.startDate} onChange={event => update("startDate", event.target.value)} /></label>
        <label className={styles.date}><span>Đến ngày</span><input type="date" required min={form.startDate} disabled={!selectedType?.allowsMultiDay} value={form.endDate} onChange={event => update("endDate", event.target.value)} /></label>
      </div>
      {selectedType?.allowsHalfDay ? <div className={styles.dateRow} data-single={form.startDate === form.endDate || undefined}>
        <Select label={form.startDate === form.endDate ? "Buổi nghỉ" : "Buổi bắt đầu"} value={form.startDayPart} onChange={event => update("startDayPart", event.target.value)} options={dayParts} />
        {form.startDate !== form.endDate ? <Select label="Buổi kết thúc" value={form.endDayPart} onChange={event => update("endDayPart", event.target.value)} options={dayParts} /> : null}
      </div> : null}
      <div aria-live="polite" className={styles.estimate}><span>Số ngày nghỉ</span><strong>{estimate === undefined ? "—" : `${estimate} ngày`}</strong></div>
      {previewError ? <p className="form-error" role="alert">{previewError}</p> : null}
      {selectedType?.deductsBalance && selectedBalance ? <dl className={styles.balance}>
        <div><dt>Còn lại</dt><dd>{selectedBalance.officialRemaining}</dd></div>
        <div><dt>Chờ duyệt</dt><dd>{selectedBalance.pending}</dd></div>
        <div><dt>Khả dụng</dt><dd>{selectedBalance.availableAfterPending}</dd></div>
        <div><dt>Sau khi duyệt</dt><dd>{estimate === undefined ? "—" : selectedBalance.availableAfterPending - estimate}</dd></div>
      </dl> : null}
    </fieldset>
    <section className={styles.section}>
      <h2><span className={`${styles.sectionIcon} ${styles.purple}`}><FileText size={21} /></span>Thông tin đơn</h2>
      <label className={styles.reason}><span>Lý do{selectedType?.requiresReason ? " *" : ""}</span><textarea disabled={loading || busy || Boolean(draft) && !requestId} required={selectedType?.requiresReason} rows={5} minLength={selectedType?.requiresReason ? 2 : undefined} maxLength={3000} value={form.reason} onChange={event => update("reason", event.target.value)} /></label>
      {draft?.attachments.length ? <div className={styles.savedAttachments}>{draft.attachments.map(attachment => <a key={attachment.id} href={`/api/v1/leave-requests/${draft.id}/attachments/${attachment.id}`} target="_blank" rel="noreferrer">{attachment.fileName}</a>)}</div> : null}
      <div className={styles.attachment}>
        <span>Tài liệu đính kèm{selectedType?.requiresAttachment ? " *" : ""}</span>
        <label className={styles.upload}>
          <Paperclip aria-hidden="true" size={20} /><span>{file ? file.name : "Chọn tài liệu"}</span>
          <input accept="application/pdf,image/png,image/jpeg" type="file" disabled={busy || attached} onChange={event => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {file && !attached ? <IconButton disabled={busy} label="Bỏ tài liệu" onClick={() => setFile(null)}><X size={16} /></IconButton> : null}
      </div>
    </section>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {draft ? <Link className="text-link" href={`/leave/requests/${draft.id}`}>Mở đơn nháp {draft.requestNumber}</Link> : null}
    <div className={styles.actions}><Button busy={busy} disabled={loading || busy || Boolean(requestId) && !draft} onClick={() => void save(false)}>{requestId ? "Lưu thay đổi" : "Lưu nháp"}</Button><Button busy={busy} disabled={loading || busy || Boolean(requestId) && !draft} leftIcon={<Send size={17} />} type="submit" variant="primary">Gửi duyệt</Button></div>
  </form>;
}
