"use client";

import { Button } from "@/components/shared/Button";
import { Select } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";

export function LocalizationPage() {
  const editor = useSettingsEditor("localization");
  return (
    <AdminPage title="Định dạng & thời gian">
      <section className="settings-form-card">
        <FormSection title="Mặc định hệ thống">
          <Select disabled label="Múi giờ" options={[{ label: "Việt Nam (Asia/Ho_Chi_Minh)", value: "Asia/Ho_Chi_Minh" }]} value={editor.draft.timezone} />
          <Select label="Định dạng ngày" onChange={(event) => editor.setDraft({ ...editor.draft, dateFormat: event.target.value as typeof editor.draft.dateFormat })} options={[{ label: "DD/MM/YYYY", value: "DD/MM/YYYY" }, { label: "YYYY-MM-DD", value: "YYYY-MM-DD" }]} value={editor.draft.dateFormat} />
          <Select disabled label="Định dạng giờ" options={[{ label: "24 giờ (HH:mm)", value: "HH:mm" }]} value={editor.draft.timeFormat} />
          <Select disabled label="Ngày đầu tuần" options={[{ label: "Thứ Hai", value: "monday" }]} value={editor.draft.weekStartsOn} />
          <Select disabled label="Ngôn ngữ" options={[{ label: "Tiếng Việt", value: "vi-VN" }]} value={editor.draft.locale} />
        </FormSection>
        {editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}
        <StickyActionBar>
          <Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>Hoàn tác</Button>
          <Button disabled={!editor.dirty || editor.saving} onClick={() => void editor.save()} variant="primary" busy={editor.saving}>{"Xuất bản"}</Button>
        </StickyActionBar>
      </section>
    </AdminPage>
  );
}
