"use client";

import { ImageIcon, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/shared/Button";

type Side = "front" | "back";

function IdentitySide({ employeeId, side, assetId, canEdit }: { employeeId: string; side: Side; assetId?: string; canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = side === "front" ? "Mặt trước" : "Mặt sau";
  const src = `/api/v1/employees/${employeeId}/identity-documents/${side}`;

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    const form = new FormData(); form.set("file", file);
    const response = await fetch(src, { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setError(body.error?.message ?? "Không thể tải ảnh."); return; }
    router.refresh();
  }

  async function remove() {
    setBusy(true); setError("");
    const response = await fetch(src, { method: "DELETE" });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setError(body.error?.message ?? "Không thể xóa ảnh."); return; }
    router.refresh();
  }

  return <section className="identity-document-side">
    <strong>{label}</strong>
    <div className="identity-document-preview">
      {assetId ? <Image alt={`CCCD ${label.toLocaleLowerCase("vi")}`} height={260} src={`${src}?v=${assetId}`} unoptimized width={420} /> : <span><ImageIcon aria-hidden="true" size={30}/></span>}
    </div>
    {canEdit ? <div className="identity-document-actions">
      <input accept="image/jpeg,image/png,image/webp" hidden onChange={(event)=>void upload(event.target.files?.[0])} ref={input} type="file"/>
      <Button disabled={busy} leftIcon={<Upload size={15}/>} onClick={()=>input.current?.click()} size="sm">{assetId ? "Thay ảnh" : "Tải ảnh"}</Button>
      {assetId ? <Button disabled={busy} leftIcon={<Trash2 size={15}/>} onClick={()=>void remove()} size="sm" variant="danger">Xóa</Button> : null}
    </div> : null}
    {error ? <p className="form-error">{error}</p> : null}
  </section>;
}

export function IdentityDocumentPanel({ employeeId, frontAssetId, backAssetId, canEdit }: { employeeId: string; frontAssetId?: string; backAssetId?: string; canEdit: boolean }) {
  return <div className="identity-document-grid">
    <IdentitySide assetId={frontAssetId} canEdit={canEdit} employeeId={employeeId} side="front"/>
    <IdentitySide assetId={backAssetId} canEdit={canEdit} employeeId={employeeId} side="back"/>
  </div>;
}
