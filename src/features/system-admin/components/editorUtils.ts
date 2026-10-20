"use client";

import { useEffect, useState } from "react";

import type { SystemSettingsDocument, SystemSettingsGroup } from "@/config/systemSettings";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";

interface ApiBody<T> {
  ok: boolean;
  data?: { value: T };
  error?: { message: string };
}

export function useSettingsEditor<TGroup extends SystemSettingsGroup>(group: TGroup) {
  const { settings, updateGroup } = useSystemSettings();
  const source = settings[group];
  const [draft, setDraft] = useState<SystemSettingsDocument[TGroup]>(() => structuredClone(source));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);

  useEffect(() => {
    document.body.dataset.systemAdminDirty = String(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      delete document.body.dataset.systemAdminDirty;
    };
  }, [dirty]);

  async function save(): Promise<boolean> {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/system-settings/${group}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft)
      });
      const body = (await response.json()) as ApiBody<SystemSettingsDocument[TGroup]>;
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể lưu cấu hình.");
      updateGroup(group, body.data.value);
      setDraft(structuredClone(body.data.value));
      setMessage("Đã cập nhật cấu hình.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu cấu hình.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(structuredClone(source));
    setMessage("");
  }

  return { source, draft, setDraft, dirty, saving, message, save, reset };
}
