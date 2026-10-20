"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input, Select } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import type { ProjectProgressNode } from "@/features/projects/types/projectTypes";
import { FieldOperationSheets } from "./FieldOperationSheets";
import styles from "./PackageWorkspace.module.css";
import { ProgressBoard } from "./ProgressBoard";
const typeLabels = { phase: "Giai đoạn", work_item: "Gói công việc", task: "Đầu việc", milestone: "Mốc kiểm soát", acceptance: "Nghiệm thu" };
const statusLabels = { not_started: "Chưa triển khai", in_progress: "Đang thi công", blocked: "Đang vướng", completed: "Hoàn thành", cancelled: "Đã hủy" };
export function PackageConstructionWorkspace({ accountId, projectId, selectedWorksiteId, canEdit, canFieldUpdate, initialNodes, onNodesChange, initialLoadError, assignees = [], today }: {
  accountId: string; projectId: string; selectedWorksiteId?: string; canEdit: boolean; canFieldUpdate: boolean; initialNodes: ProjectProgressNode[]; onNodesChange: (nodes: ProjectProgressNode[]) => void; initialLoadError?: string; assignees?: Array<{ id: string; label: string }>; today?: string;
}) {
  const pathname = usePathname(), params = useSearchParams(), router = useRouter(), pending = useRef(false);
  const nodes = initialNodes, [editing, setEditing] = useState<ProjectProgressNode>(), [parentId, setParentId] = useState<string>(), [editorOpen, setEditorOpen] = useState(false), [error, setError] = useState(initialLoadError ?? ""), [mutating, setMutating] = useState<string>();
  const todayKey = today ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const mode = params.get("mode"), operationMode = mode === "field-update" || mode === "report-issue" ? mode : undefined, operationNodeId = params.get("task") ?? undefined;
  function saveNodes(next: ProjectProgressNode[]) { onNodesChange(next); }
  function openOperation(nextMode: "field-update" | "report-issue", nodeId?: string) { const next = new URLSearchParams(params.toString()); next.set("mode", nextMode); if (nodeId) next.set("task", nodeId); else next.delete("task"); window.history.pushState(null, "", `${pathname}?${next}`); }
  function closeOperation() { const next = new URLSearchParams(params.toString()); next.delete("mode"); next.delete("task"); window.history.replaceState(null, "", next.size ? `${pathname}?${next}` : pathname); router.refresh(); }
  function openCreate(nextParentId?: string) { setEditing(undefined); setParentId(nextParentId); setError(""); setEditorOpen(true); }
  function openEdit(node: ProjectProgressNode) { setEditing(node); setParentId(undefined); setError(""); setEditorOpen(true); }
  function closeEditor() { if (pending.current) return; setEditorOpen(false); setEditing(undefined); setParentId(undefined); setError(""); }
  async function request(method: string, values: unknown) {
    const response = await fetch(`/api/v1/projects/${projectId}/progress`, { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(45000), body: JSON.stringify(values) });
    const body = await response.json() as { data?: ProjectProgressNode[]; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể cập nhật công việc.");
    return body.data;
  }
  async function quickUpdate(node: ProjectProgressNode) {
    if (pending.current) return; pending.current = true; setMutating(`${node.id}:completed`); setError("");
    try { saveNodes(await request("PATCH", { ...node, status: "completed", completionPercent: 100 })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể cập nhật tiến độ."); }
    finally { pending.current = false; setMutating(undefined); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return; const form = new FormData(event.currentTarget), status = String(form.get("status"));
    pending.current = true; setMutating("editor"); setError("");
    try {
      saveNodes(await request(editing ? "PATCH" : "POST", { id: editing?.id, rowVersion: editing?.rowVersion, parentId: editing?.parentId ?? parentId, nodeType: form.get("nodeType"), name: form.get("name"), status, completionPercent: status === "completed" ? 100 : status === "not_started" ? 0 : Number(form.get("completionPercent")), deadline: form.get("deadline") || undefined, assigneeEmployeeId: form.get("assigneeEmployeeId") || undefined, sortOrder: editing?.sortOrder ?? nodes.length }));
      setEditorOpen(false); setEditing(undefined); setParentId(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu công việc."); }
    finally { pending.current = false; setMutating(undefined); }
  }
  const options = assignees.map(person => ({ value: person.id, label: person.label }));
  if (editing?.assigneeEmployeeId && !options.some(person => person.value === editing.assigneeEmployeeId)) options.push({ value: editing.assigneeEmployeeId, label: editing.assigneeName ?? "Người phụ trách đã lưu" });
  return <><ProgressBoard canEdit={canEdit} canFieldUpdate={canFieldUpdate} error={!editorOpen ? error : undefined} mutating={mutating} nodes={nodes} onComplete={node => void quickUpdate(node)} onCreate={openCreate} onEdit={openEdit} onOperation={openOperation} today={todayKey} />
    <FieldOperationSheets accountId={accountId} initialNodeId={operationNodeId} key={`${operationMode}-${operationNodeId ?? "new"}`} mode={canFieldUpdate ? operationMode : undefined} nodes={nodes} onClose={closeOperation} onSaved={saveNodes} projectId={projectId} selectedWorksiteId={selectedWorksiteId} />
    <Modal onClose={closeEditor} open={editorOpen} title={editing ? "Cập nhật công việc" : parentId ? "Thêm công việc con" : "Thêm công việc"}><form className={styles.editorForm} key={editing?.id ?? parentId ?? "new"} onSubmit={submit}><fieldset className={styles.progressEditorFields} disabled={Boolean(mutating)}><Input defaultValue={editing?.name} label="Tên công việc" maxLength={200} minLength={2} name="name" required /><Select defaultValue={editing?.nodeType ?? (parentId ? "task" : "work_item")} label="Loại công việc" name="nodeType" options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} /><Select defaultValue={editing?.status ?? "not_started"} label="Trạng thái" name="status" options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} /><Input defaultValue={editing?.completionPercent ?? 0} label="Hoàn thành (%)" max="100" min="0" name="completionPercent" required type="number" /><Input defaultValue={editing?.deadline} label="Hạn hoàn thành" name="deadline" type="date" /><Select defaultValue={editing?.assigneeEmployeeId} label="Người phụ trách" name="assigneeEmployeeId" options={options} placeholder="Chưa phân công" /></fieldset>{error ? <p className={styles.inlineError} role="alert">{error}</p> : null}<footer className={styles.drawerFooter}><span /><div><Button disabled={Boolean(mutating)} onClick={closeEditor}>Hủy</Button><Button busy={Boolean(mutating)} disabled={Boolean(mutating)} type="submit" variant="primary">Lưu công việc</Button></div></footer></form></Modal>
  </>;
}
