"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import type { ProjectIssue } from "@/features/projects/types/projectTypes";

export function IssueActions({ issue }: { issue: ProjectIssue }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [note, setNote] = useState(""); const [message, setMessage] = useState(""); const resolved = issue.status === "resolved" || issue.status === "closed";
  async function submit() { const action = resolved ? "reopen" : "resolve"; const response = await fetch(`/api/v1/project-issues/${issue.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resolved ? { reason: note } : { resolutionNote: note }) }); const body = await response.json() as { error?: { message: string } }; if (!response.ok) { setMessage(body.error?.message ?? "Không thể cập nhật."); return; } setOpen(false); setNote(""); router.refresh(); }
  if (!open) return <Button onClick={() => setOpen(true)} size="sm" variant="ghost">{resolved ? "Mở lại" : "Đánh dấu đã xử lý"}</Button>;
  return <div className="issue-inline-action"><Input label={resolved ? "Lý do mở lại" : "Kết quả xử lý"} minLength={3} onChange={(event) => setNote(event.target.value)} value={note} /><div><Button onClick={() => setOpen(false)} size="sm">Hủy</Button><Button disabled={note.trim().length < 3} onClick={() => void submit()} size="sm" variant="primary">Xác nhận</Button></div>{message ? <small>{message}</small> : null}</div>;
}
