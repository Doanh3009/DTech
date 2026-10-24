"use client";

import { Boxes, Check, ChevronDown, ChevronRight, CircleCheck, ClipboardList, Search, Factory, Warehouse } from "lucide-react";
import { useId, useState } from "react";
import styles from "./Marketing.module.css";

const previews = [
  { label: "Kho vật tư", icon: Warehouse, navigation: ["Tồn kho", "Nhập / xuất", "Lô hàng", "Hạn sử dụng"], rows: ["Phiếu nhập vật tư", "Phiếu xuất công trường", "Lô hàng chờ kiểm tra"], stages: ["Lập phiếu", "Kiểm tra", "Ghi nhận kho"] },
  { label: "Sản xuất", icon: Factory, navigation: ["Lệnh sản xuất", "Định mức", "Công đoạn", "Thành phẩm"], rows: ["Lệnh gia công GC-024", "Cấp nguyên liệu MI-018", "Nhập thành phẩm FG-012"], stages: ["Phát hành lệnh", "Sản xuất", "Nhập thành phẩm"] },
  { label: "Dự án", icon: ClipboardList, navigation: ["Công trình", "Ngân sách", "Cấp vật tư", "Tiến độ"], rows: ["Ngân sách CT-021", "Cấp vật tư PM-015", "Tiến độ công trình 70%"], stages: ["Lập kế hoạch", "Thực hiện", "Theo dõi"] }
] as const;

export function ProductPreview() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const current = previews[selected];
  const Icon = current.icon;
  return <div className={styles.previewArea}>
    <div className={styles.previewWindow}>
      <div className={styles.previewChrome}><span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span><span>dimixo / workspace</span><span className={styles.sampleLabel}>Mẫu giao diện</span></div>
      <div aria-labelledby={`${id}-tab-${selected}`} className={styles.previewBody} id={`${id}-panel`} role="tabpanel">
        <aside className={styles.previewSidebar} aria-label="Menu minh họa"><div className={styles.previewBrand}><span>D</span><strong>DIMIXO</strong></div><span className={styles.previewModule}><Icon size={17} />{current.label}</span>{current.navigation.map((item, index) => <span className={index === 0 ? styles.previewActive : undefined} key={item}><Boxes size={14} aria-hidden="true" />{item}</span>)}</aside>
        <div className={styles.previewContent}>
          <div className={styles.previewToolbar}><span>{current.label}<ChevronRight aria-hidden="true" size={12} />Nghiệp vụ</span><Search aria-hidden="true" size={15} /><span className={styles.previewAvatar}>DX</span></div>
          <div className={styles.previewHeading}><strong>{current.label}</strong><span><Check aria-hidden="true" size={13} />Không gian doanh nghiệp</span></div>
          <div className={styles.previewFlow}>{current.stages.map((stage, index) => <span key={stage}><i>{index + 1}</i>{stage}{index < 2 ? <ChevronRight aria-hidden="true" size={14} /> : <CircleCheck aria-hidden="true" size={14} />}</span>)}</div>
          <div className={styles.previewTable}><div><span>Nghiệp vụ</span><span>Quy trình</span><ChevronDown aria-hidden="true" size={12} /></div>{current.rows.map((row, index) => <div key={row}><span><span className={styles.previewFile}><ClipboardList aria-hidden="true" size={14} /></span>{row}</span><span>{index === 0 ? "Đang thực hiện" : index === 1 ? "Đã ghi nhận" : "Đối chiếu"}</span><ChevronRight aria-hidden="true" size={12} /></div>)}</div>
          <div className={styles.previewFooter}><span className={styles.previewOnline} />Phân quyền theo vai trò<span>Đồng bộ quy trình</span></div>
        </div>
      </div>
    </div>
    <div aria-label="Xem giao diện minh họa" className={styles.previewTabs} role="tablist">{previews.map((item, index) => { const TabIcon = item.icon; return <button aria-controls={`${id}-panel`} aria-selected={selected === index} id={`${id}-tab-${index}`} key={item.label} onClick={() => setSelected(index)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? previews.length - 1 : (selected + (event.key === "ArrowRight" ? 1 : -1) + previews.length) % previews.length; setSelected(next); document.getElementById(`${id}-tab-${next}`)?.focus(); } }} role="tab" tabIndex={selected === index ? 0 : -1} type="button"><TabIcon size={16} aria-hidden="true" />{item.label}</button>; })}</div>
  </div>;
}
