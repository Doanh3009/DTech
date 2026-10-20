"use client";

import { ImageIcon, RotateCcw, Upload } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import type { BrandAssetType } from "@/services/system-settings/brandAssetService";
import { defaultSystemSettings } from "@/config/systemSettings";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";

type AssetField = "logoMainUrl" | "logoCompactUrl" | "logoDarkUrl" | "faviconUrl";

const assetRows: Array<{ field: AssetField; type: BrandAssetType; label: string; ratio: "wide" | "square" }> = [
  { field: "logoMainUrl", type: "logo_main", label: "Logo chính", ratio: "wide" },
  { field: "logoCompactUrl", type: "logo_compact", label: "Logo compact", ratio: "square" },
  { field: "logoDarkUrl", type: "logo_dark", label: "Logo nền tối", ratio: "wide" },
  { field: "faviconUrl", type: "favicon", label: "Favicon", ratio: "square" }
];

async function checkDimensions(file: File, ratio: "wide" | "square"): Promise<void> {
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    });
    const actualRatio = dimensions.width / dimensions.height;
    if (ratio === "square" && (actualRatio < 0.8 || actualRatio > 1.2)) throw new Error("Ảnh cần có tỷ lệ 1:1.");
    if (ratio === "wide" && (actualRatio < 2 || actualRatio > 6)) throw new Error("Logo ngang cần có tỷ lệ từ 2:1 đến 6:1.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BrandingPage() {
  const { settings, updateGroup } = useSystemSettings();
  const [branding, setBranding] = useState(() => structuredClone(settings.branding));
  const [organization, setOrganization] = useState(() => structuredClone(settings.organization));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AssetField | null>(null);
  useLoadingActivity(uploading !== null);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(branding) !== JSON.stringify(settings.branding) || JSON.stringify(organization) !== JSON.stringify(settings.organization);

  useEffect(() => {
    document.body.dataset.systemAdminDirty = String(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      delete document.body.dataset.systemAdminDirty;
    };
  }, [dirty]);

  async function upload(event: ChangeEvent<HTMLInputElement>, field: AssetField, type: BrandAssetType, ratio: "wide" | "square") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Chỉ chấp nhận PNG, JPG hoặc WEBP.");
      await checkDimensions(file, ratio);
      setUploading(field);
      const form = new FormData();
      form.set("file", file);
      form.set("assetType", type);
      const response = await fetch("/api/v1/brand-assets", { method: "POST", body: form });
      const body = await response.json() as { data?: { asset: { url: string } }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tải tệp lên.");
      setBranding((current) => ({ ...current, [field]: body.data!.asset.url, assetVersion: current.assetVersion + 1 }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải tệp lên.");
    } finally {
      setUploading(null);
    }
  }

  async function publish() {
    setSaving(true);
    setMessage("");
    try {
      const requests: Array<Promise<Response>> = [];
      if (JSON.stringify(branding) !== JSON.stringify(settings.branding)) {
        requests.push(fetch("/api/v1/system-settings/branding", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(branding) }));
      }
      if (JSON.stringify(organization) !== JSON.stringify(settings.organization)) {
        requests.push(fetch("/api/v1/system-settings/organization", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(organization) }));
      }
      const responses = await Promise.all(requests);
      for (const response of responses) {
        if (!response.ok) {
          const body = await response.json() as { error?: { message: string } };
          throw new Error(body.error?.message ?? "Không thể lưu cấu hình.");
        }
      }
      updateGroup("branding", branding);
      updateGroup("organization", organization);
      setMessage("Đã cập nhật cấu hình.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setBranding(structuredClone(settings.branding));
    setOrganization(structuredClone(settings.organization));
    setMessage("");
  }

  function restoreDefaults() {
    if (!window.confirm("Khôi phục cấu hình thương hiệu mặc định?")) return;
    setBranding(structuredClone(defaultSystemSettings.branding));
    setMessage("");
  }

  return (
    <AdminPage title="Thương hiệu">
      <section className="settings-form-card">
        <FormSection title="Nhận diện hệ thống">
          <Input label="Tên hiển thị hệ thống" maxLength={100} onChange={(event) => setBranding({ ...branding, systemName: event.target.value })} value={branding.systemName} />
          <Input label="Tên công ty" maxLength={120} onChange={(event) => setOrganization({ ...organization, companyName: event.target.value })} value={organization.companyName} />
          <Input label="Tên viết tắt" maxLength={30} onChange={(event) => setOrganization({ ...organization, shortName: event.target.value })} value={organization.shortName} />
          <Input label="Tiêu đề phụ trang đăng nhập" maxLength={140} onChange={(event) => setBranding({ ...branding, loginSubtitle: event.target.value })} value={branding.loginSubtitle} />
        </FormSection>
        <FormSection columns={1} title="Logo & favicon">
          <div className="brand-assets-grid">
            {assetRows.map((asset) => (
              <div className="brand-asset-row" key={asset.field}>
                <div className="brand-asset-preview">
                  {branding[asset.field] ? <NextImage alt={asset.label} height={64} src={branding[asset.field]!} unoptimized width={104} /> : <><ImageIcon aria-hidden="true" size={22} /><span>{asset.field === "faviconUrl" ? "CT" : organization.shortName}</span></>}
                </div>
                <strong>{asset.label}</strong>
                <div className="brand-asset-actions">
                  <label className="button button--secondary button--sm">
                    <Upload aria-hidden="true" size={15} />
                    <span>{branding[asset.field] ? "Thay thế" : "Tải lên"}</span>
                    <input accept="image/png,image/jpeg,image/webp" disabled={uploading !== null} hidden onChange={(event) => void upload(event, asset.field, asset.type, asset.ratio)} type="file" />
                  </label>
                  {branding[asset.field] ? <Button onClick={() => setBranding({ ...branding, [asset.field]: null, assetVersion: branding.assetVersion + 1 })} size="sm" variant="ghost">Xóa</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </FormSection>
        {message ? <div aria-live="polite" className="save-feedback">{message}</div> : null}
        <StickyActionBar>
          <Button onClick={restoreDefaults} variant="ghost">Khôi phục mặc định</Button>
          <Button disabled={!dirty || saving} leftIcon={<RotateCcw aria-hidden="true" size={16} />} onClick={reset}>Hoàn tác</Button>
          <Button disabled={!dirty || saving || uploading !== null} onClick={() => void publish()} variant="primary" busy={saving}>{"Xuất bản"}</Button>
        </StickyActionBar>
      </section>
    </AdminPage>
  );
}
