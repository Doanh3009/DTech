"use client";

import { useState, type CSSProperties } from "react";
import { Plus, RotateCcw } from "lucide-react";

import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Button } from "@/components/shared/Button";
import { ErpModuleCard } from "@/components/shared/ErpModuleCard";
import { Input, Select, Switch } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { visibleApplications } from "@/config/moduleRegistry";
import { AdminPage } from "@/features/system-admin/components/AdminPage";
import styles from "@/components/shared/ErpPlatform.module.css";

const colors = [
  { label: "Thương hiệu", token: "--color-primary" }, { label: "Bề mặt", token: "--surface" },
  { label: "Văn bản", token: "--text-primary" }, { label: "Thành công", token: "--success" },
  { label: "Cảnh báo", token: "--warning" }, { label: "Lỗi", token: "--danger" }
];

export function DesignDnaPage() {
  const { settings } = useSystemSettings();
  const user = useCurrentUser();
  const examples = visibleApplications(user, settings.modules).slice(0, 3);
  const [sample, setSample] = useState("");
  const [density, setDensity] = useState("standard");
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState(false);

  return <AdminPage title="Design DNA" actions={<StatusBadge tone="info">DIMIXO ERP · 1.0</StatusBadge>}>
    <section aria-labelledby="dna-identity" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="dna-identity">{settings.organization.shortName}</h2><StatusBadge tone="success">{settings.appearance.density === "compact" ? "Gọn" : settings.appearance.density === "comfortable" ? "Thoải mái" : "Tiêu chuẩn"}</StatusBadge></div>
      <div className={styles.swatches}>{colors.map((color) => <div className={styles.swatch} key={color.token}><span aria-hidden="true" style={{ "--swatch-color": `var(${color.token})` } as CSSProperties} /><strong>{color.label}</strong></div>)}</div>
    </section>
    <div className={styles.twoColumns}>
      <section aria-labelledby="dna-typography" className={styles.panel}>
        <div className={styles.sectionHeading}><h2 id="dna-typography">Kiểu chữ</h2><span className={styles.count}>Inter · Tiếng Việt</span></div>
        <div className={styles.typeSamples}>
          <div><strong style={{ fontSize: "var(--font-page)" }}>Tiêu đề trang</strong><small>24–30 / 600</small></div>
          <div><strong style={{ fontSize: "var(--font-section)" }}>Tiêu đề khu vực</strong><small>21 / 600</small></div>
          <div><span style={{ fontSize: "var(--font-body)" }}>Dữ liệu nghiệp vụ</span><small>16 / 400</small></div>
          <div><span style={{ fontSize: "var(--font-meta)" }}>Nhãn & Trạng thái</span><small>13 / 500</small></div>
        </div>
      </section>
      <section aria-labelledby="dna-geometry" className={styles.panel}>
        <div className={styles.sectionHeading}><h2 id="dna-geometry">Khoảng cách & Hình khối</h2><span className={styles.count}>Đơn vị: px</span></div>
        <div className={styles.spacing}>{[4, 8, 12, 16, 24, 32].map((size) => <div key={size}><i aria-hidden="true" style={{ "--sample-size": `var(--space-${size / 4})` } as CSSProperties} /><span>{size}</span></div>)}</div>
        <div className={styles.actions}><StatusBadge tone="neutral">Điều khiển 44</StatusBadge><StatusBadge tone="neutral">Bo góc 12 / 18 / 22</StatusBadge></div>
      </section>
    </div>
    <section aria-labelledby="dna-actions" className={styles.panel}>
      <div className={styles.sectionHeading}><h2 id="dna-actions">Thao tác & Trạng thái</h2><StatusBadge tone="neutral">Mẫu</StatusBadge></div>
      <div className={styles.actions}>
        <Button leftIcon={<Plus aria-hidden="true" size={16} />} onClick={() => setSaved(true)} variant="primary">Thao tác chính</Button>
        <Button onClick={() => setSaved(false)}>Thao tác phụ</Button><Button disabled>Vô hiệu hóa</Button>
        <Button leftIcon={<RotateCcw aria-hidden="true" size={16} />} onClick={() => { setSample(""); setDensity("standard"); setActive(true); setSaved(false); }} variant="ghost">Đặt lại mẫu</Button>
      </div>
      <div aria-live="polite" className={styles.actions}>{saved ? <StatusBadge tone="success">Đã thao tác mẫu</StatusBadge> : <><StatusBadge tone="neutral">Nháp</StatusBadge><StatusBadge tone="info">Đang xử lý</StatusBadge><StatusBadge tone="warning">Chờ duyệt</StatusBadge><StatusBadge tone="success">Hoàn tất</StatusBadge><StatusBadge tone="error">Lỗi</StatusBadge></>}</div>
    </section>
    <div className={styles.twoColumns}>
      <section aria-labelledby="dna-form" className={styles.panel}>
        <div className={styles.sectionHeading}><h2 id="dna-form">Biểu mẫu</h2><StatusBadge tone="neutral">Mẫu</StatusBadge></div>
        <Input label="Tên mẫu" onChange={(event) => setSample(event.target.value)} placeholder="Nhập tên" value={sample} />
        <Select label="Mật độ mẫu" onChange={(event) => setDensity(event.target.value)} options={[{ label: "Tiêu chuẩn", value: "standard" }, { label: "Gọn", value: "compact" }]} value={density} />
        <Switch checked={active} label="Kích hoạt mẫu" onCheckedChange={setActive} />
      </section>
      <section aria-labelledby="dna-data" className={styles.panel}>
        <div className={styles.sectionHeading}><h2 id="dna-data">Bảng dữ liệu</h2><StatusBadge tone="neutral">Mẫu</StatusBadge></div>
        <table className={styles.sampleTable} data-density={density}><caption className="sr-only">Dữ liệu minh họa Design DNA</caption><thead><tr><th scope="col">Mã</th><th scope="col">Trạng thái</th><th scope="col">Số lượng</th></tr></thead><tbody>
          <tr><td>MẪU-01</td><td><StatusBadge tone={active ? "success" : "neutral"}>{active ? "Đang bật" : "Đang tắt"}</StatusBadge></td><td>24</td></tr>
          <tr><td>MẪU-02</td><td><StatusBadge tone="warning">Chờ duyệt</StatusBadge></td><td>12</td></tr>
          <tr><td>MẪU-03</td><td><StatusBadge tone="neutral">Nháp</StatusBadge></td><td>8</td></tr>
        </tbody></table><span className={styles.count}>{sample || "Chưa đặt tên mẫu"}</span>
      </section>
    </div>
    {examples.length ? <section aria-labelledby="dna-module" className={styles.section}><div className={styles.sectionHeading}><h2 id="dna-module">Thẻ module</h2></div><div className={styles.grid}>{examples.map((application) => <ErpModuleCard application={application} key={application.id} />)}</div></section> : null}
  </AdminPage>;
}
