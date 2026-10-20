"use client";

import { Check, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackLink } from "@/components/shared/BackLink";
import { Button, IconButton } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Checkbox, Input, Select, Textarea } from "@/components/shared/FormControls";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/shared/States";
import { processAttendanceImage } from "@/features/attendance/client/imageProcessing";
import { captureAttendanceLocation } from "@/features/attendance/client/locationCapture";
import { AttendanceLocationAddress } from "@/features/attendance/components/AttendanceLocationAddress";
import { WorkerSelector } from "@/features/employees/components/EmployeePicker";
import type { EmployeePickerOption } from "@/features/employees/types";
import { deleteWorkerDraft, getWorkerDraft, saveWorkerDraft, type LocalWorkerPhoto, type WorkerLocalDraft } from "@/features/worker-attendance/client/workerDraftStore";
import { fetchWorkerSession, readWorkerResponse, syncWorkerDraft } from "@/features/worker-attendance/client/workerAttendanceSync";
import { countWorkerAttendance, hasWorkerCoordinates } from "@/features/worker-attendance/services/workerAttendanceRules";
import type { WorkerAttendanceEntry, WorkerAttendanceSession, WorkerEntryStatus } from "@/features/worker-attendance/types/workerAttendanceTypes";

type WizardStep = "roster" | "photos" | "review";

const statuses: Array<{ value: WorkerEntryStatus; label: string }> = [
  { value: "unconfirmed", label: "Chưa xác nhận" }, { value: "present", label: "Có mặt" },
  { value: "late", label: "Đi trễ" }, { value: "absent", label: "Vắng" },
  { value: "leave", label: "Nghỉ phép" }, { value: "transferred", label: "Điều chuyển" }
];
const stepLabels: Record<WizardStep, string> = { roster: "Danh sách", photos: "Ảnh", review: "Xác nhận" };

function route(id: string, step: WizardStep) { return `/worker-attendance/sessions/${id}/${step}`; }

function DraftPhoto({ photo }: { photo: Blob }) {
  const [url] = useState(() => URL.createObjectURL(photo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <Image alt="Ảnh điểm danh chưa đồng bộ" height={240} src={url} unoptimized width={320} />;
}

export function WorkerAttendanceWizard({ sessionId, step, employeeOptions = [] }: { sessionId: string; step: WizardStep; employeeOptions?: EmployeePickerOption[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<WorkerLocalDraft>();
  const draftRef = useRef<WorkerLocalDraft | undefined>(undefined);
  const draftWrites = useRef<Promise<void>>(Promise.resolve());
  const navigationBusy = useRef(false);
  const [query, setQuery] = useState("");
  const [onlyUnprocessed, setOnlyUnprocessed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showTemporary, setShowTemporary] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<string>();
  const [existingReason, setExistingReason] = useState("support");
  const [photoFile, setPhotoFile] = useState<File>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");

  const load = useCallback(async () => {
    try {
      const local = await getWorkerDraft(sessionId);
      if (local) {
        draftRef.current = local;
        setDraft(local);
        if (local.pendingSubmit && navigator.onLine) {
          const session = await syncWorkerDraft(local);
          router.replace(`/worker-attendance/sessions/${session.id}`);
        }
        return;
      }
      if (sessionId.startsWith("local-")) throw new Error("Không tìm thấy bản nháp trên thiết bị này.");
      const session = await fetchWorkerSession(sessionId);
      const value: WorkerLocalDraft = { id: session.id, ownerAccountId: "server", clientSessionId: session.clientSessionId, session, photos: [], pendingSubmit: false, retryCount: 0, updatedAt: new Date().toISOString() };
      await saveWorkerDraft(value); draftRef.current = value; setDraft(value);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Không thể mở phiên điểm danh."); }
  }, [router, sessionId]);
  useEffect(() => {
    // Restore the device draft before falling back to the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!draft?.pendingSubmit) return;
    const retry = () => {
      void syncWorkerDraft(draft).then((session) => router.replace(`/worker-attendance/sessions/${session.id}`)).catch(() => undefined);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [draft, router]);

  async function update(next: WorkerLocalDraft) {
    draftRef.current = next;
    setDraft(next);
    const saved = draftWrites.current.catch(() => undefined).then(() => saveWorkerDraft(next));
    draftWrites.current = saved;
    await saved;
  }

  function reportDraftError() {
    setMessage("Chưa lưu được điểm danh trên thiết bị. Vui lòng chọn lại trạng thái để thử lại.");
  }

  async function retryLocation() {
    if (!draft) return;
    setLocationBusy(true); setLocationError("");
    try {
      const coordinates = await captureAttendanceLocation(navigator.geolocation, window.isSecureContext);
      const location = { latitude: coordinates.latitude, longitude: coordinates.longitude, accuracy: coordinates.accuracy };
      await update({ ...draft, location, session: { ...draft.session, latitude: location.latitude, longitude: location.longitude, accuracyMeters: location.accuracy, worksiteAddress: undefined, geofenceStatus: "valid" }, updatedAt: new Date().toISOString() });
    } catch (caught) { setLocationError(caught instanceof Error ? caught.message : "Chưa xác định được GPS."); }
    finally { setLocationBusy(false); }
  }

  function updateEntry(entryId: string, patch: Partial<WorkerAttendanceEntry>) {
    const current = draftRef.current;
    if (!current || navigationBusy.current || current.pendingSubmit) return;
    setMessage("");
    const next = { ...current, session: { ...current.session, entries: current.session.entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry) }, updatedAt: new Date().toISOString() };
    void update(next).catch(reportDraftError);
  }

  function markAllPresent() {
    const current = draftRef.current;
    if (!current || navigationBusy.current || current.pendingSubmit) return;
    setMessage("");
    void update({ ...current, session: { ...current.session, entries: current.session.entries.map((entry) => entry.status === "leave" && entry.exceptionReason === "approved_leave" ? entry : { ...entry, status: "present", exceptionReason: undefined }) }, updatedAt: new Date().toISOString() }).catch(reportDraftError);
  }

  function updateChecklist(itemId: string, checked: boolean) {
    if (!draft) return;
    const current = draft.session.checklistResponses.filter((response) => response.itemId !== itemId);
    const next = { ...draft, session: { ...draft.session, checklistResponses: [...current, { itemId, checked }] }, updatedAt: new Date().toISOString() };
    void update(next).catch(reportDraftError);
  }

  async function saveAndGo(nextStep: WizardStep) {
    if (!draftRef.current || navigationBusy.current || photoBusy) return;
    navigationBusy.current = true;
    setBusy(true); setMessage("");
    try {
      await draftWrites.current;
      const current = draftRef.current;
      if (!current) return;
      let nextId = current.id;
      if (navigator.onLine) { const session = await syncWorkerDraft(current); nextId = session.id; }
      else setMessage("Đã lưu trên thiết bị.");
      router.push(route(nextId, nextStep));
    } catch (caught) { setMessage(caught instanceof Error ? `${caught.message} Bản nháp vẫn còn trên thiết bị.` : "Bản nháp vẫn còn trên thiết bị."); }
    finally { navigationBusy.current = false; setBusy(false); }
  }

  async function saveRoster() {
    if (!draftRef.current || navigationBusy.current) return;
    navigationBusy.current = true;
    setBusy(true); setMessage("");
    try {
      await draftWrites.current;
      const current = draftRef.current;
      if (!current) return;
      if (!navigator.onLine) { setMessage("Đã lưu điểm danh trên thiết bị."); return; }
      const session = await syncWorkerDraft(current);
      // Keep the visible roster in place when the database returns updated rows.
      const order = new Map(current.session.entries.map((entry, index) => [entry.workerId, index]));
      const entries = [...session.entries].sort((first, second) => (order.get(first.workerId) ?? Number.MAX_SAFE_INTEGER) - (order.get(second.workerId) ?? Number.MAX_SAFE_INTEGER));
      await update({ ...current, id: session.id, session: { ...session, entries }, photos: [], retryCount: 0, updatedAt: new Date().toISOString() });
      setMessage("Đã lưu điểm danh.");
      if (session.id !== current.id) router.replace(route(session.id, "roster"));
    } catch (caught) { setMessage(caught instanceof Error ? `${caught.message} Bản nháp vẫn còn trên thiết bị.` : "Chưa đồng bộ được. Bản nháp vẫn còn trên thiết bị."); }
    finally { navigationBusy.current = false; setBusy(false); }
  }

  async function addPhoto(file?: File) {
    if (!draft || !file) return;
    setPhotoBusy(true); setPhotoError(""); setMessage("");
    try {
      const processed = await processAttendanceImage(file);
      const photo: LocalWorkerPhoto = { id: crypto.randomUUID(), photo: processed.photo, thumbnail: processed.thumbnail, width: processed.width, height: processed.height, capturedAt: new Date().toISOString(), uploaded: false };
      await update({ ...draft, photos: [...draft.photos, photo], session: { ...draft.session, photoStatus: "pending_upload" }, updatedAt: new Date().toISOString() });
      setPhotoFile(undefined);
    } catch (caught) { setPhotoError(caught instanceof Error ? caught.message : "Không thể xử lý ảnh."); }
    finally { setPhotoBusy(false); }
  }

  async function addTemporary(formData: FormData) {
    if (!draft || draft.id.startsWith("local-")) { setMessage("Cần có mạng để thêm công nhân ngoài kế hoạch."); return; }
    setBusy(true); setMessage("");
    try {
      const session = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${draft.id}/temporary-worker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) }));
      await update({ ...draft, session, updatedAt: new Date().toISOString() }); setShowTemporary(false);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Không thể thêm công nhân."); }
    finally { setBusy(false); }
  }

  async function addExisting() {
    if (!draft || !selectedExistingId || draft.id.startsWith("local-")) { setMessage("Cần có mạng và chọn một công nhân."); return; }
    setBusy(true); setMessage("");
    try {
      const session = await readWorkerResponse<WorkerAttendanceSession>(await fetch(`/api/v1/worker-attendance/sessions/${draft.id}/existing-worker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workerId: selectedExistingId, unplannedReason: existingReason }) }));
      await update({ ...draft, session, updatedAt: new Date().toISOString() }); setSelectedExistingId(undefined); setShowTemporary(false);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Không thể thêm công nhân."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!draft) return;
    if (draft.session.geofenceStatus !== "not_required" && !hasWorkerCoordinates(draft.session)) {
      setLocationError("Chưa có tọa độ GPS. Hãy thử lại vị trí.");
      return;
    }
    const pending = { ...draft, pendingSubmit: true, updatedAt: new Date().toISOString() };
    await update(pending); setBusy(true); setMessage("");
    try {
      if (!navigator.onLine) { setMessage("Đã xếp hàng gửi khi có mạng."); return; }
      const session = await syncWorkerDraft(pending);
      await deleteWorkerDraft(draft.id);
      router.replace(`/worker-attendance/sessions/${session.id}`);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Chưa thể gửi phiên."); }
    finally { setBusy(false); }
  }

  const visibleEntries = useMemo(() => draft?.session.entries.filter((entry) => (!onlyUnprocessed || entry.status === "unconfirmed") && `${entry.employeeCode} ${entry.workerName}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))) ?? [], [draft, onlyUnprocessed, query]);
  const counts = useMemo(() => countWorkerAttendance(draft?.session.entries ?? []), [draft]);
  const checklistGroups = useMemo(() => {
    const groups = new Map<string, WorkerAttendanceSession["checklist"]>();
    for (const item of draft?.session.checklist ?? []) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    return [...groups.entries()];
  }, [draft]);
  if (!draft) return message ? <Card><div className="form-message form-message--error">{message}</div></Card> : <LoadingState title="Đang mở phiên điểm danh" />;

  return (
    <div className="worker-wizard">
      <BackLink href={step === "roster" ? "/worker-attendance/today" : route(draft.id, step === "photos" ? "roster" : "photos")} />
      <div className="worker-wizard__title"><div><h1>{draft.session.projectName}</h1><span>{draft.session.worksiteName} · {draft.session.shiftName}</span></div><StatusBadge status={draft.session.syncStatus}>{draft.session.syncStatus === "synced" ? "Đã đồng bộ" : "Bản nháp"}</StatusBadge></div>
      <nav className="worker-steps" aria-label="Các bước điểm danh">{(["roster", "photos", "review"] as WizardStep[]).map((item, index) => <button aria-current={step === item ? "step" : undefined} className={step === item ? "is-active" : ""} disabled={busy || photoBusy} key={item} onClick={() => void saveAndGo(item)} type="button"><span>{step === item ? <Check size={14} /> : index + 1}</span>{stepLabels[item]}</button>)}</nav>
      {message ? <div className="form-message form-message--info">{message}</div> : null}

      {step === "roster" ? <>
        <Card className="worker-roster-card">
          <div className="worker-roster-actions"><div className="search-input"><Search size={17} /><input aria-label="Tìm công nhân" className="input" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm công nhân" value={query} /></div><Button aria-pressed={onlyUnprocessed} onClick={() => setOnlyUnprocessed((value) => !value)} size="sm" variant={onlyUnprocessed ? "soft" : "secondary"}>Chưa xử lý</Button><Button disabled={busy || draft.pendingSubmit || !draft.session.entries.length} onClick={markAllPresent} size="sm" variant="primary">Có mặt tất cả</Button></div>
          <div className="worker-roster-list">{visibleEntries.map((entry) => <article className="worker-roster-row" key={entry.id}><div><strong>{entry.workerName}</strong>{entry.isUnplanned ? <span>Ngoài kế hoạch</span> : null}</div><div aria-label={`Điểm danh ${entry.workerName}`} className="worker-status-chips" role="group">{(["present", "leave", "absent", "late"] as WorkerEntryStatus[]).map((value) => <button aria-pressed={entry.status === value} className={entry.status === value ? "is-active" : ""} disabled={busy || draft.pendingSubmit} key={value} onClick={() => updateEntry(entry.id, { status: value, exceptionReason: value === "absent" ? "unknown" : value === "leave" ? "approved_leave" : undefined })} type="button">{statuses.find((item) => item.value === value)?.label}</button>)}</div>{entry.status === "absent" || entry.status === "leave" || entry.status === "transferred" ? <Select label={`Lý do ${entry.workerName}`} labelHidden className="select worker-row-reason" disabled={busy || draft.pendingSubmit} onChange={(event) => updateEntry(entry.id, { exceptionReason: event.target.value as WorkerAttendanceEntry["exceptionReason"] })} value={entry.exceptionReason ?? "unknown"} options={[{ label: "Có phép", value: "approved_leave" }, { label: "Không phép", value: "unapproved" }, { label: "Chưa rõ", value: "unknown" }, { label: "Công trường khác", value: "other_worksite" }, { label: "Khác", value: "other" }]} /> : null}</article>)}</div>
          <Button leftIcon={<UserPlus size={16} />} onClick={() => setShowTemporary((value) => !value)} variant="ghost">Thêm công nhân</Button>
          {showTemporary ? <div className="worker-add-person"><section><h4>Đã có hồ sơ</h4><WorkerSelector label="Tìm công nhân" onSelect={(option) => setSelectedExistingId(option.id)} options={employeeOptions} selectedId={selectedExistingId} /><Select label="Lý do" onChange={(event) => setExistingReason(event.target.value)} options={[{ value: "mobilized", label: "Điều động" }, { value: "support", label: "Hỗ trợ" }, { value: "replacement", label: "Thay thế" }, { value: "other", label: "Khác" }]} value={existingReason} /><Button disabled={busy || !selectedExistingId} onClick={() => void addExisting()} variant="primary">Thêm vào danh sách</Button></section><section><h4>Chưa có hồ sơ</h4><form action={addTemporary} className="worker-temporary-form"><Input label="Họ tên" name="fullName" required /><Input label="Số điện thoại" name="phone" /><Input label="Nhà thầu" name="contractorName" /><Select label="Lý do" name="unplannedReason" options={[{ value: "mobilized", label: "Điều động" }, { value: "support", label: "Hỗ trợ" }, { value: "replacement", label: "Thay thế" }, { value: "other", label: "Khác" }]} required /><Button disabled={busy} type="submit" variant="primary">Tạo và thêm</Button></form></section></div> : null}
        </Card>
        <div className="worker-counts"><span>Tổng <strong>{counts.total}</strong></span><span>Có mặt <strong>{counts.present}</strong></span><span>Vắng <strong>{counts.absent + counts.leave}</strong></span><span>Chưa xác nhận <strong>{counts.unconfirmed}</strong></span></div>
        <div className="sticky-action-bar"><Button busy={busy} disabled={busy || draft.pendingSubmit} onClick={() => void saveRoster()} size="lg">Lưu điểm danh</Button><Button disabled={busy || draft.pendingSubmit || counts.unconfirmed > 0} onClick={() => void saveAndGo("photos")} size="lg" variant="primary">Tiếp tục {counts.total - counts.unconfirmed}/{counts.total}</Button></div>
      </> : null}

      {step === "photos" ? <>
        <Card><div className="worker-photo-grid">{draft.session.photos.map((photo) => <Image alt="Ảnh điểm danh" height={240} key={photo.id} src={`/api/v1/worker-attendance/photos/${photo.id}?size=thumbnail`} unoptimized width={320} />)}{draft.photos.map((photo) => <div className="worker-photo-local" key={photo.id}><DraftPhoto photo={photo.thumbnail} /><IconButton label="Xóa ảnh" onClick={() => void update({ ...draft, photos: draft.photos.filter((item) => item.id !== photo.id), updatedAt: new Date().toISOString() })}><Trash2 size={17} /></IconButton></div>)}</div><ImageUploader accept="image/*" capture="environment" disabled={busy} error={photoError} file={photoFile} label="Ảnh toàn cảnh" onFileChange={(file) => { setPhotoFile(file); setPhotoError(""); if (file) void addPhoto(file); }} onRetry={() => void addPhoto(photoFile)} uploading={photoBusy} /></Card>
        <div className="sticky-action-bar"><Button disabled={busy} onClick={() => void saveAndGo("review")} size="lg" variant="primary">Tiếp tục</Button></div>
      </> : null}

      {step === "review" ? <>
        <Card><div className="worker-review-grid"><span>Tổng<strong>{counts.total}</strong></span><span>Có mặt<strong>{counts.present}</strong></span><span>Đi trễ<strong>{counts.late}</strong></span><span>Vắng / nghỉ<strong>{counts.absent + counts.leave}</strong></span><span>Ảnh<strong>{draft.session.photos.length + draft.photos.length}</strong></span><span>Vị trí<strong><AttendanceLocationAddress accuracyMeters={draft.session.accuracyMeters} emptyLabel={draft.session.geofenceStatus === "not_required" ? "Không yêu cầu" : "Chưa có GPS"} knownAddress={draft.session.worksiteAddress} latitude={draft.session.latitude} longitude={draft.session.longitude} referenceName={draft.session.worksiteName} /></strong></span></div><div className="action-row"><Button disabled={locationBusy || busy} leftIcon={<RefreshCw aria-hidden="true" size={16} />} onClick={() => void retryLocation()} busy={locationBusy}>{"Thử lại GPS"}</Button></div>{locationError ? <div className="form-message form-message--error" role="alert">{locationError}</div> : null}{checklistGroups.length ? <div className="worker-checklist">{checklistGroups.map(([group, items]) => <fieldset key={group}><legend>{group}</legend>{items.map((item) => <Checkbox checked={draft.session.checklistResponses.some((response) => response.itemId === item.id && response.checked)} key={item.id} label={`${item.content}${item.required ? " *" : ""}`} onChange={(event) => updateChecklist(item.id, event.target.checked)} />)}</fieldset>)}</div> : null}<Textarea label="Nội dung công việc" onChange={(event) => void update({ ...draft, session: { ...draft.session, workNote: event.target.value }, updatedAt: new Date().toISOString() })} value={draft.session.workNote ?? ""} /><Textarea label="Ghi chú" onChange={(event) => void update({ ...draft, session: { ...draft.session, note: event.target.value }, updatedAt: new Date().toISOString() })} value={draft.session.note ?? ""} /></Card>
        <div className="sticky-action-bar"><Button disabled={busy || locationBusy} onClick={() => void submit()} size="lg" variant="primary" busy={busy}>{"Hoàn tất điểm danh"}</Button></div>
      </> : null}
    </div>
  );
}
