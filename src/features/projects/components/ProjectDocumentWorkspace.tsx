"use client";

import { ExternalLink, FileSpreadsheet, FileText, FileType2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/States";
import type { ProjectUpdate } from "@/features/projects/types/projectTypes";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(mimeType: string) {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("word")) return FileType2;
  return FileText;
}

export function ProjectDocumentWorkspace({ projectId, updates, canUpload }: { projectId: string; updates: ProjectUpdate[]; canUpload: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const documents = useMemo(() => updates.flatMap((update) => update.attachments
    .filter((attachment) => attachment.attachmentType !== "image")
    .map((attachment) => ({ ...attachment, updateId: update.id, authorName: update.authorName }))), [updates]);

  async function upload(files: File[]) {
    if (!files.length || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const createResponse = await fetch(`/api/v1/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUpdateId: crypto.randomUUID(),
          updateType: "general",
          title: "Tài liệu gói",
          content: `Tải lên ${files.map((file) => file.name).join(", ")}`,
          status: "done",
          publishStatus: "published",
          issueFlag: false,
          capturedAtClient: new Date().toISOString()
        })
      });
      const created = await createResponse.json() as { data?: { id: string }; error?: { message?: string } };
      if (!createResponse.ok || !created.data) throw new Error(created.error?.message ?? "Không thể tạo tài liệu.");
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch(`/api/v1/project-updates/${created.data.id}/attachments`, { method: "POST", body: form });
        const body = await response.json() as { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? `Không thể tải ${file.name}.`);
      }
      setMessage(`Đã tải ${files.length} tài liệu.`);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể tải tài liệu.");
    } finally {
      setSaving(false);
    }
  }

  return <Card className="project-documents">
    <header className="project-documents__toolbar">
      <div><span>Tài liệu gói</span><h2>{documents.length} tệp</h2></div>
      {canUpload ? <>
        <input accept="application/pdf,.docx,.xlsx" aria-label="Chọn tài liệu" hidden multiple onChange={(event) => void upload(Array.from(event.target.files ?? []))} ref={inputRef} type="file" />
        <Button disabled={saving} leftIcon={<Upload aria-hidden="true" size={16} />} onClick={() => inputRef.current?.click()} variant="primary" busy={saving}>{"Thêm tài liệu"}</Button>
      </> : null}
    </header>
    {message ? <div className="project-documents__message" role="status">{message}</div> : null}
    {documents.length ? <div className="project-document-list">{documents.map((document) => {
      const Icon = iconFor(document.mimeType);
      return <a className="project-document-row" href={`/api/v1/files/${document.fileId}/signed-url`} key={document.id} rel="noreferrer" target="_blank">
        <span className="project-document-row__icon"><Icon aria-hidden="true" size={19} /></span>
        <span><strong>{document.fileName}</strong><small>{document.authorName} · {new Date(document.uploadedAt).toLocaleDateString("vi-VN")}</small></span>
        <small>{fileSize(document.sizeBytes)}</small>
        <ExternalLink aria-hidden="true" size={17} />
      </a>;
    })}</div> : <EmptyState title="Chưa có tài liệu" />}
  </Card>;
}
