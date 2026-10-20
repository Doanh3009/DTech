"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { IconButton, Button } from "@/components/shared/Button";
import { Select, Switch } from "@/components/shared/FormControls";
import { StickyActionBar } from "@/components/shared/FormLayout";
import { configurableNavigationPaths } from "@/config/systemSettings";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import { useSettingsEditor } from "@/features/system-admin/components/editorUtils";

const labels: Record<(typeof configurableNavigationPaths)[number], string> = {
  "/dashboard": "Dashboard", "/employees": "Nhân viên", "/employees/departments": "Phòng ban", "/employees/positions": "Chức vụ", "/employees/contracts": "Hợp đồng", "/employees/insurance": "Bảo hiểm xã hội", "/attendance/today": "Chấm công hôm nay", "/attendance/logs": "Nhật ký công", "/timesheets/matrix": "Bảng công", "/timesheets": "Kỳ công", "/timesheets/adjustments": "Điều chỉnh công", "/shifts": "Ca làm", "/shifts/calendar": "Lịch làm việc", "/leave/manage": "Quản lý nghỉ phép", "/attendance": "Chấm công", "/attendance/me": "Hôm nay", "/attendance/history": "Lịch công của tôi", "/attendance/requests": "Đơn của tôi", "/attendance/notifications": "Thông báo của tôi", "/leave": "Nghỉ phép", "/projects": "Gói / Công trường", "/projects/updates": "Cập nhật dự án", "/worker-attendance": "Điểm danh công nhân", "/warehouse/items": "Hàng hóa", "/warehouse/receipts": "Nhập kho", "/warehouse/issues": "Xuất kho", "/warehouse/transfers": "Chuyển kho", "/warehouse/inventory": "Tồn kho", "/import-export": "Tổng quan XNK", "/import-export/shipments": "Lô hàng", "/import-export/transport": "Vận chuyển", "/import-export/contracts": "Hợp đồng / PO", "/import-export/documents": "Chứng từ", "/import-export/customs": "Thông quan", "/import-export/partners": "Đối tác", "/approvals": "Phê duyệt", "/documents": "Tài liệu", "/reports": "Báo cáo"
};

export function NavigationPage() {
  const editor = useSettingsEditor("navigation");
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= editor.draft.itemOrder.length) return;
    const order = [...editor.draft.itemOrder];
    [order[index], order[target]] = [order[target], order[index]];
    editor.setDraft({ ...editor.draft, itemOrder: order });
  }
  function setVisible(path: (typeof configurableNavigationPaths)[number], visible: boolean) {
    const hidden = visible ? editor.draft.hiddenItems.filter((item) => item !== path) : [...new Set([...editor.draft.hiddenItems, path])];
    editor.setDraft({ ...editor.draft, hiddenItems: hidden });
  }
  return <AdminPage title="Điều hướng"><section className="settings-form-card"><div className="form-section"><div className="form-section__header"><h2>Menu chính</h2></div><div className="navigation-editor">{editor.draft.itemOrder.map((path, index) => <div className="navigation-editor__row" key={path}><div className="navigation-editor__move"><IconButton disabled={index === 0} label="Di chuyển lên" onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" size={16} /></IconButton><IconButton disabled={index === editor.draft.itemOrder.length - 1} label="Di chuyển xuống" onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" size={16} /></IconButton></div><strong>{labels[path]}</strong><code>{path}</code><Switch checked={!editor.draft.hiddenItems.includes(path)} label="Hiển thị" onCheckedChange={(checked) => setVisible(path, checked)} /></div>)}</div></div><div className="form-section"><div className="form-section__header"><h2>Mặc định</h2></div><div className="form-section__grid"><Select label="Trang bắt đầu" onChange={(e) => editor.setDraft({ ...editor.draft, defaultLandingPage: e.target.value as typeof editor.draft.defaultLandingPage })} options={[{ label: "Dashboard", value: "/dashboard" }, { label: "Chấm công", value: "/attendance" }, { label: "Dự án", value: "/projects" }]} value={editor.draft.defaultLandingPage} /><Switch checked={editor.draft.groupsExpanded} label="Mở rộng nhóm menu" onCheckedChange={(checked) => editor.setDraft({ ...editor.draft, groupsExpanded: checked })} /></div></div>{editor.message ? <div aria-live="polite" className="save-feedback">{editor.message}</div> : null}<StickyActionBar><Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>Hoàn tác</Button><Button disabled={!editor.dirty || editor.saving} onClick={() => void editor.save()} variant="primary" busy={editor.saving}>{"Xuất bản"}</Button></StickyActionBar></section></AdminPage>;
}
