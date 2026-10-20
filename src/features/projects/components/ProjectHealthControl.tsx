"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/shared/Button";
import { Input, Select } from "@/components/shared/FormControls";
import type { ProjectHealth } from "@/features/projects/types/projectTypes";

export function ProjectHealthControl({ projectId, health }: { projectId: string; health: ProjectHealth }) {
  const router = useRouter(); const [value, setValue] = useState<ProjectHealth>(health); const [reason, setReason] = useState(""); const [message, setMessage] = useState("");
  async function save() { const response = await fetch(`/api/v1/projects/${projectId}/health`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ health: value, reason: reason || undefined }) }); const body = await response.json() as { error?: { message: string } }; if (!response.ok) { setMessage(body.error?.message ?? "Không thể cập nhật."); return; } setMessage("Đã cập nhật tình trạng dự án."); setReason(""); router.refresh(); }
  return <div className="project-health-control"><Select label="Tình trạng dự án" onChange={(event) => setValue(event.target.value as ProjectHealth)} options={[{ value: "on_track", label: "Đúng tiến độ" }, { value: "at_risk", label: "Có rủi ro" }, { value: "delayed", label: "Chậm tiến độ" }, { value: "paused", label: "Tạm dừng" }, { value: "completed", label: "Hoàn thành" }]} value={value} />{value !== health ? <><Input label="Lý do" onChange={(event) => setReason(event.target.value)} required={value === "delayed"} value={reason} /><Button onClick={() => void save()} variant="primary">Cập nhật</Button></> : null}{message ? <span role="status">{message}</span> : null}</div>;
}
