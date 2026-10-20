"use client";

import { Button } from "@/components/shared/Button";
import { Input, Textarea } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";

export function OrganizationPage() {
  const editor = useSettingsEditor("organization");
  const update = (key: keyof typeof editor.draft, value: string) => editor.setDraft({ ...editor.draft, [key]: value });
  return <AdminPage title="Tổ chức"><section className="settings-form-card"><FormSection title="Thông tin doanh nghiệp"><Input label="Tên công ty" onChange={(e) => update("companyName", e.target.value)} value={editor.draft.companyName} /><Input label="Tên viết tắt" onChange={(e) => update("shortName", e.target.value)} value={editor.draft.shortName} /><Textarea label="Địa chỉ" onChange={(e) => update("address", e.target.value)} value={editor.draft.address} /><Input label="Số điện thoại" onChange={(e) => update("phone", e.target.value)} value={editor.draft.phone} /><Input label="Email" onChange={(e) => update("email", e.target.value)} type="email" value={editor.draft.email} /><Input label="Mã số thuế" onChange={(e) => update("taxCode", e.target.value)} value={editor.draft.taxCode} /><Input label="Người đại diện" onChange={(e) => update("representativeName", e.target.value)} value={editor.draft.representativeName} /></FormSection>{editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}<StickyActionBar><Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>Hoàn tác</Button><Button disabled={!editor.dirty || editor.saving} onClick={() => void editor.save()} variant="primary" busy={editor.saving}>{"Xuất bản"}</Button></StickyActionBar></section></AdminPage>;
}
