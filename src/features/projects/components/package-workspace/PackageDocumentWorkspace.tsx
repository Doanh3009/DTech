"use client";

import { Download, FileSpreadsheet, FileText, FileType2, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Select } from "@/components/shared/FormControls";
import { EmptyState } from "@/components/shared/States";
import type { ProjectUpdate, ProjectUpdateAttachment } from "@/features/projects/types/projectTypes";

import styles from "./PackageWorkspace.module.css";

type DocumentItem = ProjectUpdateAttachment & { authorName: string; updateId: string; version: number; versionCount: number };

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

function makeDocuments(updates: ProjectUpdate[]): DocumentItem[] {
  const items = updates.flatMap((update) => update.attachments
    .filter((attachment) => attachment.attachmentType !== "image")
    .map((attachment) => ({ ...attachment, authorName: update.authorName, updateId: update.id })));
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const item of items) totals.set(item.fileName, (totals.get(item.fileName) ?? 0) + 1);
  return items.map((item) => {
    const version = (seen.get(item.fileName) ?? 0) + 1;
    seen.set(item.fileName, version);
    return { ...item, version, versionCount: totals.get(item.fileName) ?? 1 };
  });
}

export function PackageDocumentWorkspace({ projectId, updates, canUpload, selectedWorksiteId }: { projectId: string; updates: ProjectUpdate[]; canUpload: boolean; selectedWorksiteId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const documents = useMemo(() => makeDocuments(updates), [updates]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return documents.filter((document) => {
      const matchesType = type === "all" || document.attachmentType === type;
      const matchesQuery = !normalized || `${document.fileName} ${document.authorName}`.toLocaleLowerCase("vi-VN").includes(normalized);
      return matchesType && matchesQuery;
    });
  }, [documents, query, type]);

  async function upload(files: File[]) {
    if (!files.length || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const createResponse = await fetch(`/api/v1/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientUpdateId: crypto.randomUUID(),
          worksiteId: selectedWorksiteId,
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

  const uploadButton = (
    <Button disabled={saving} leftIcon={<Upload aria-hidden="true" size={17} />} onClick={() => inputRef.current?.click()} variant="primary" busy={saving}>
      {"Tải tài liệu"}
    </Button>
  );

  return (
    <section className={styles.documentsWorkspace}>
      <header className={styles.workspaceHeading}>
        <div><h2>Tài liệu</h2><p>{documents.length} tệp</p></div>
        {canUpload ? <div className={styles.headingActions}>{uploadButton}</div> : null}
      </header>
      {canUpload ? <input accept="application/pdf,.doc,.docx,.xls,.xlsx" aria-label="Chọn tài liệu" hidden multiple onChange={(event) => void upload(Array.from(event.target.files ?? []))} ref={inputRef} type="file" /> : null}
      <div className={styles.fileToolbar}>
        <label className={styles.searchControl}>
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">Tìm tài liệu</span>
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên tệp hoặc người tải" type="search" value={query} />
        </label>
        <Select
          label="Loại tài liệu"
          labelHidden
          onChange={(event) => setType(event.target.value)}
          options={[
            { value: "all", label: "Tất cả loại" },
            { value: "pdf", label: "PDF" },
            { value: "document", label: "Văn bản" },
            { value: "spreadsheet", label: "Bảng tính" }
          ]}
          value={type}
        />
      </div>
      {message ? <p className={styles.statusMessage} role="status">{message}</p> : null}
      <div className={styles.fileList}>
        {visible.map((document) => {
          const Icon = iconFor(document.mimeType);
          return (
            <article className={styles.fileRow} key={document.id}>
              <span className={styles.fileIcon}><Icon aria-hidden="true" size={20} /></span>
              <div className={styles.fileName}>
                <strong>{document.fileName}</strong>
                <span>{document.authorName} · {new Date(document.uploadedAt).toLocaleDateString("vi-VN")}</span>
              </div>
              <span className={styles.fileMeta}>{fileSize(document.sizeBytes)}</span>
              <span className={styles.fileMeta}>{document.versionCount > 1 ? `v${document.version}` : "—"}</span>
              <a aria-label={`Mở ${document.fileName}`} className={styles.fileAction} href={`/api/v1/files/${document.fileId}/signed-url`} rel="noreferrer" target="_blank">
                <Download aria-hidden="true" size={18} />
                <span>Tải</span>
              </a>
            </article>
          );
        })}
        {!visible.length ? <EmptyState title={documents.length ? "Không có tài liệu phù hợp" : "Chưa có tài liệu"} /> : null}
      </div>
    </section>
  );
}

