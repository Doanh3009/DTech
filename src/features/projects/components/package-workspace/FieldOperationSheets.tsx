"use client";

import { Camera, Check, CircleAlert, Save, ShieldAlert } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Select, Textarea } from "@/components/shared/FormControls";
import { Drawer } from "@/components/shared/Overlays";
import {
  compressFieldPhoto,
  saveFieldQueueItem,
  syncFieldQueueItem,
  type FieldQueueItem,
  type FieldQueuePhoto
} from "@/features/projects/client/fieldUpdateQueue";
import type { ProjectIssueSeverity, ProjectProgressNode } from "@/features/projects/types/projectTypes";

import styles from "./PackageWorkspace.module.css";
import progressStyles from "./FieldProgressForm.module.css";

const statusLabels: Record<ProjectProgressNode["status"], string> = {
  not_started: "Chưa triển khai",
  in_progress: "Đang thi công",
  blocked: "Đang vướng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy"
};

function PhotoPicker({ photos, onChange, onError }: { photos: FieldQueuePhoto[]; onChange: (photos: FieldQueuePhoto[]) => void; onError: (message: string) => void }) {
  const previews = useMemo(() => photos.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) })), [photos]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  async function choose(files: File[]) {
    try {
      const compressed = await Promise.all(files.slice(0, 6 - photos.length).map(compressFieldPhoto));
      onChange([...photos, ...compressed]);
      onError("");
    } catch {
      onError("Không thể xử lý ảnh. Vui lòng chọn ảnh khác.");
    }
  }
  return <div className={styles.photoField}><label><span>Ảnh hiện trường · {photos.length}/6</span><strong><Camera aria-hidden="true" size={19} />Chụp hoặc chọn ảnh</strong><input accept="image/jpeg,image/png,image/webp" disabled={photos.length >= 6} multiple onChange={(event) => { void choose(Array.from(event.target.files ?? [])); event.target.value = ""; }} type="file" /></label>{previews.length ? <div>{previews.map((preview, index) => <figure key={preview.id}><Image alt={`Ảnh hiện trường ${index + 1}`} height={120} src={preview.url} unoptimized width={160} /><button aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => onChange(photos.filter((photo) => photo.id !== preview.id))} type="button">×</button></figure>)}</div> : null}</div>;
}

function makeQueueItem({ accountId, projectId, worksiteId, progressPatch, title, content, updateType, issueSeverity, photos }: {
  accountId: string;
  projectId: string;
  worksiteId?: string;
  progressPatch?: ProjectProgressNode;
  title: string;
  content: string;
  updateType: "progress" | "issue";
  issueSeverity?: ProjectIssueSeverity;
  photos: FieldQueuePhoto[];
}): FieldQueueItem {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    ownerAccountId: accountId,
    projectId,
    worksiteId,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    retryCount: 0,
    progressPatch,
    progressSynced: false,
    update: {
      clientUpdateId: id,
      worksiteId,
      updateType,
      title,
      content,
      status: updateType === "issue" || progressPatch?.status === "blocked" || progressPatch?.status === "not_started" ? "waiting" : progressPatch?.status === "completed" ? "done" : "in_progress",
      publishStatus: "published",
      issueFlag: updateType === "issue",
      issueSeverity,
      capturedAtClient: now
    },
    photos,
    uploadedPhotoIds: []
  };
}

export function FieldOperationSheets({ accountId, projectId, selectedWorksiteId, nodes, initialNodeId, mode, onClose, onSaved }: {
  accountId: string;
  projectId: string;
  selectedWorksiteId?: string;
  nodes: ProjectProgressNode[];
  initialNodeId?: string;
  mode?: "field-update" | "report-issue";
  onClose: () => void;
  onSaved: (nodes: ProjectProgressNode[]) => void;
}) {
  // An explicit phase action must never silently select a different task.
  const selectableNodes = nodes.filter((node) => node.nodeType !== "phase" || node.id === initialNodeId);
  const initialNode = selectableNodes.find((node) => node.id === initialNodeId) ?? selectableNodes[0];
  const [nodeId, setNodeId] = useState(initialNode?.id ?? "");
  const [status, setStatus] = useState<ProjectProgressNode["status"]>(initialNode?.status ?? "not_started");
  const [percent, setPercent] = useState(initialNode?.completionPercent ?? 0);
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<ProjectIssueSeverity>("medium");
  const [photos, setPhotos] = useState<FieldQueuePhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedNode = nodes.find((node) => node.id === nodeId);

  function chooseNode(nextId: string) {
    const next = nodes.find((node) => node.id === nextId);
    setNodeId(nextId);
    if (next) { setPercent(next.completionPercent); setStatus(next.status); }
  }

  function chooseStatus(nextStatus: ProjectProgressNode["status"]) {
    setStatus(nextStatus);
    if (nextStatus === "completed") setPercent(100);
    if (nextStatus === "not_started") setPercent(0);
    if (status === "completed" && nextStatus !== "completed" && nextStatus !== "not_started") setPercent(95);
  }

  function choosePercent(nextPercent: number) {
    const bounded = Math.max(0, Math.min(100, nextPercent));
    setPercent(bounded);
    if (status === "completed" && bounded < 100) setStatus("in_progress");
    if (status === "not_started" && bounded > 0) setStatus("in_progress");
  }

  async function saveProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNode || saving) return;
    setSaving(true); setError("");
    const finalPercent = status === "completed" ? 100 : status === "not_started" ? 0 : percent;
    const progressPatch = { ...selectedNode, status, completionPercent: finalPercent };
    const item = makeQueueItem({ accountId, projectId, worksiteId: selectedWorksiteId, progressPatch, title: selectedNode.name, content: [`${selectedNode.name}: ${finalPercent}% · ${statusLabels[status]}`, note.trim()].filter(Boolean).join("\n"), updateType: "progress", photos });
    try {
      await saveFieldQueueItem(item);
      onSaved(nodes.map((node) => node.id === selectedNode.id ? progressPatch : node));
      if (navigator.onLine) {
        try {
          const synced = await syncFieldQueueItem(item);
          if (synced.nodes) onSaved(synced.nodes);
        } catch {
          // The persisted queue item owns retries; closing avoids accidental duplicate submissions.
        }
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu dữ liệu trên thiết bị.");
    } finally { setSaving(false); }
  }

  async function saveIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNode || !note.trim() || saving) return;
    setSaving(true); setError("");
    const item = makeQueueItem({ accountId, projectId, worksiteId: selectedWorksiteId, title: selectedNode.name, content: note.trim(), updateType: "issue", issueSeverity: severity, photos });
    try {
      await saveFieldQueueItem(item);
      if (navigator.onLine) {
        try { await syncFieldQueueItem(item); } catch { /* Retry is handled by the persisted queue. */ }
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu báo vướng trên thiết bị.");
    } finally { setSaving(false); }
  }

  const nodeSelect = <Select label="Công việc" onChange={(event) => chooseNode(event.target.value)} options={selectableNodes.map((node) => ({ value: node.id, label: node.name }))} placeholder="Chọn công việc" required value={nodeId} />;

  return <>
    <Drawer className={progressStyles.dialog} onClose={() => { if (!saving) onClose(); }} open={mode === "field-update"} title="Cập nhật tiến độ">
      <form className={progressStyles.form} onSubmit={saveProgress}>
        <div className={progressStyles.body}>
          {initialNodeId && selectedNode ? <div className={progressStyles.workSummary}><span>Công việc</span><strong>{selectedNode.name}</strong><div><span>{statusLabels[selectedNode.status]}</span><span>Hiện tại {selectedNode.completionPercent}%</span>{selectedNode.completionPercent === 100 && selectedNode.status !== "completed" ? <span>Chưa xác nhận hoàn tất</span> : null}</div></div> : nodeSelect}
          <fieldset className={progressStyles.statusGroup}><legend>Trạng thái công việc</legend><div>{(["not_started", "in_progress", "blocked", "completed"] as const).map((value) => <button aria-pressed={status === value} key={value} onClick={() => chooseStatus(value)} type="button">{status === value ? <Check aria-hidden="true" size={15} /> : null}{statusLabels[value]}</button>)}</div></fieldset>
          <div className={progressStyles.progressGroup}><header><label htmlFor="field-progress-range">Mức hoàn thành</label><strong>{percent}%</strong></header><div className={progressStyles.rangeTrack}><progress aria-hidden="true" max="100" value={percent} /><input disabled={status === "not_started" || status === "completed"} id="field-progress-range" max="100" min="0" onChange={(event) => choosePercent(Number(event.target.value))} step="1" type="range" value={percent} /></div><div className={progressStyles.progressScale}><span>0%</span><span>100%</span></div><div className={progressStyles.progressActions}><Button disabled={status === "not_started" || status === "completed"} onClick={() => choosePercent(percent - 10)} type="button">−10%</Button><Button disabled={status === "not_started" || status === "completed"} onClick={() => choosePercent(percent + 10)} type="button">+10%</Button></div></div>
          <div className={progressStyles.evidence}><PhotoPicker onChange={setPhotos} onError={setError} photos={photos} /><Textarea label="Ghi chú cập nhật" maxLength={500} onChange={(event) => setNote(event.target.value)} required={status === "blocked"} rows={3} value={note} /></div>
        </div>
        {error ? <p className={styles.inlineError} role="alert"><CircleAlert size={17} />{error}</p> : null}
        <footer className={progressStyles.footer}><span>{typeof navigator === "undefined" || navigator.onLine ? "Sẽ đồng bộ ngay" : "Sẽ gửi khi có mạng"}</span><div><Button disabled={saving} onClick={onClose} type="button">Hủy</Button><Button disabled={saving || !selectedNode} leftIcon={<Save size={17} />} type="submit" variant="primary" busy={saving}>{"Lưu cập nhật"}</Button></div></footer>
      </form>
    </Drawer>
    <Drawer className={styles.fieldSheet} onClose={() => { if (!saving) onClose(); }} open={mode === "report-issue"} title="Báo vướng hiện trường">
      <form className={styles.fieldSheetForm} onSubmit={saveIssue}>
        {nodeSelect}
        <fieldset className={styles.issueSeverity}><legend>Mức độ</legend>{([['low', 'Theo dõi'], ['medium', 'Cảnh báo sớm'], ['critical', 'Dừng thi công']] as const).map(([value, label]) => <button aria-pressed={severity === value} key={value} onClick={() => setSeverity(value)} type="button"><ShieldAlert size={18} />{label}</button>)}</fieldset>
        <Textarea label="Nội dung vướng mắc" maxLength={1000} onChange={(event) => setNote(event.target.value)} required rows={4} value={note} />
        <PhotoPicker onChange={setPhotos} onError={setError} photos={photos} />
        {error ? <p className={styles.inlineError} role="alert"><CircleAlert size={17} />{error}</p> : null}
        <footer className={styles.drawerFooter}><span>{typeof navigator === "undefined" || navigator.onLine ? "Sẽ đồng bộ ngay" : "Sẽ gửi khi có mạng"}</span><div><Button disabled={saving} onClick={onClose}>Hủy</Button><Button disabled={saving || !selectedNode || !note.trim()} leftIcon={<ShieldAlert size={17} />} type="submit" variant="primary" busy={saving}>{"Gửi báo vướng"}</Button></div></footer>
      </form>
    </Drawer>
  </>;
}
