"use client";

import { Camera, FileUp, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/shared/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/shared/FormControls";
import type { Worksite } from "@/features/projects/types/projectTypes";

interface Props { projectId: string; worksites: Worksite[]; initial?: { worksiteId?: string; content?: string; attendanceSessionId?: string }; }

async function readApi<T>(response: Response): Promise<T> { const body = await response.json() as { data?: T; error?: { message: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể lưu cập nhật."); return body.data; }

export function ProjectUpdateForm({ projectId, worksites, initial }: Props) {
  const router = useRouter(); const draftKey = `project-update-draft:${projectId}`;
  const [issueFlag, setIssueFlag] = useState(false); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { const saved = localStorage.getItem(draftKey); if (!saved || initial?.content) return; try { const values = JSON.parse(saved) as Record<string, string>; for (const [name, value] of Object.entries(values)) { const element = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null; if (element) element.value = value; } } catch { localStorage.removeItem(draftKey); } }, [draftKey, initial?.content]);

  function saveLocal(form: HTMLFormElement) { const data = new FormData(form); const values = Object.fromEntries([...data.entries()].filter(([, value]) => typeof value === "string")); localStorage.setItem(draftKey, JSON.stringify(values)); setMessage("Đã lưu nháp trên thiết bị."); }

  async function submit(formData: FormData, publishStatus: "draft" | "published") {
    setSaving(true); setMessage("");
    try {
      const update = await readApi<{ id: string }>(await fetch(`/api/v1/projects/${projectId}/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientUpdateId: crypto.randomUUID(), worksiteId: formData.get("worksiteId") || undefined, updateType: formData.get("updateType"), title: formData.get("title") || undefined, content: formData.get("content"), status: formData.get("status"), publishStatus, issueFlag, issueSeverity: issueFlag ? formData.get("issueSeverity") : undefined, relatedAttendanceSessionId: initial?.attendanceSessionId, capturedAtClient: new Date().toISOString() }) }));
      const files = formData.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0);
      const failed: string[] = [];
      for (const file of files) { const payload = new FormData(); payload.set("file", file); const response = await fetch(`/api/v1/project-updates/${update.id}/attachments`, { method: "POST", body: payload }); if (!response.ok) failed.push(file.name); }
      localStorage.removeItem(draftKey);
      if (failed.length) { setMessage(`Đã lưu nội dung. ${failed.length} tệp đang chờ tải lại.`); router.push(`/projects/${projectId}/updates/${update.id}`); return; }
      router.push(`/projects/${projectId}/updates/${update.id}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu cập nhật. Bản nháp vẫn còn trên thiết bị."); } finally { setSaving(false); }
  }

  return <form className="project-update-form" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget), "published"); }}>
    <div className="form-grid form-grid--two"><Select label="Loại cập nhật" name="updateType" options={[{ value: "progress", label: "Tiến độ" }, { value: "issue", label: "Vấn đề" }, { value: "material", label: "Vật tư" }, { value: "safety", label: "An toàn" }, { value: "change", label: "Thay đổi" }, { value: "general", label: "Thông tin chung" }]} required /><Select label="Tình trạng" name="status" options={[{ value: "in_progress", label: "Đang thực hiện" }, { value: "waiting", label: "Chờ xử lý" }, { value: "done", label: "Hoàn thành" }]} required /></div>
    {worksites.length > 1 ? <Select defaultValue={initial?.worksiteId} label="Công trường" name="worksiteId" options={worksites.map((site) => ({ value: site.id, label: site.name }))} placeholder="Toàn dự án" /> : <input name="worksiteId" type="hidden" value={initial?.worksiteId ?? worksites[0]?.id ?? ""} />}
    <Input label="Tiêu đề" maxLength={180} name="title" />
    <Textarea defaultValue={initial?.content} label="Nội dung" maxLength={10000} minLength={3} name="content" required rows={6} />
    <Checkbox checked={issueFlag} label="Có vấn đề cần xử lý" onChange={(event) => setIssueFlag(event.target.checked)} />
    {issueFlag ? <Select label="Mức độ" name="issueSeverity" options={[{ value: "low", label: "Thấp" }, { value: "medium", label: "Trung bình" }, { value: "high", label: "Cao" }, { value: "critical", label: "Nghiêm trọng" }]} required /> : null}
    <label className="project-upload"><span>Ảnh / tài liệu</span><span><Camera size={18} /><FileUp size={18} />Chọn tệp</span><input accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.docx" capture="environment" multiple name="attachments" type="file" /></label>
    {message ? <div className="form-message form-message--info" role="status">{message}</div> : null}
    <div className="action-row project-update-form__actions"><Button disabled={saving} leftIcon={<Save size={16} />} onClick={(event) => saveLocal(event.currentTarget.form!)}>Lưu trên thiết bị</Button><Button disabled={saving} leftIcon={<Save size={16} />} onClick={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget.form!), "draft"); }}>Lưu nháp</Button><Button disabled={saving} leftIcon={<Send size={16} />} type="submit" variant="primary">Đăng cập nhật</Button></div>
  </form>;
}
