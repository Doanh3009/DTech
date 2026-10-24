"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Check, CheckCheck, CircleCheck, Layers3, Pause, Play } from "lucide-react";
import { ProductPreview } from "./ProductPreview";
import styles from "./ProductShowcase.module.css";

/** Code-native product artwork: dimensional, responsive and still keyboard operable. */
export function ProductShowcase() {
  const [paused, setPaused] = useState(false);
  const id = useId().replace(/:/g, "");
  return <div className={styles.showcase} role="group" aria-label="Giao diện ERP nổi 3D" data-paused={paused}>
    <div className={styles.halo} aria-hidden="true" />
    <div className={styles.floor} aria-hidden="true" />
    <div className={styles.backScreen} aria-hidden="true"><span /><span /><span /></div>
    <div className={styles.analytics} aria-hidden="true">
      <header><span className={styles.cardIcon}><Layers3 size={16} /></span><strong>Tổng quan vận hành</strong><ArrowUpRight size={15} /></header>
      <div className={styles.chart}>
        <svg viewBox="0 0 236 88" fill="none"><defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3b977d" stopOpacity=".25"/><stop offset="1" stopColor="#3b977d" stopOpacity="0"/></linearGradient></defs>
          <path d="M0 68H236M0 44H236M0 20H236" stroke="#e2ece6" strokeDasharray="3 5" />
          <path d="M0 77L28 64L58 68L88 47L118 52L147 30L176 36L205 15L236 10V88H0Z" fill={`url(#${id}-fill)`} />
          <path className={styles.chartLine} d="M0 77L28 64L58 68L88 47L118 52L147 30L176 36L205 15L236 10" stroke="#2b816a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="205" cy="15" r="5" fill="#fff" stroke="#2b816a" strokeWidth="2" />
        </svg>
      </div><footer><span>Thông tin kết nối</span><span>Dữ liệu mẫu</span></footer>
    </div>
    <div className={styles.mainScreen}><ProductPreview /></div>
    <div className={styles.approval} aria-hidden="true">
      <span className={styles.approvalIcon}><CheckCheck size={22} /></span>
      <div><strong>Chứng từ liên kết</strong><span><CircleCheck size={12} />Đã xác nhận · Mẫu</span></div>
      <i><Check size={12} /></i>
    </div>
    <button className={styles.motionControl} type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} aria-label={paused ? "Bật chuyển động giao diện 3D" : "Dừng chuyển động giao diện 3D"}>{paused ? <Play size={14} aria-hidden="true"/> : <Pause size={14} aria-hidden="true"/>}<span>{paused ? "Bật chuyển động" : "Dừng chuyển động"}</span></button>
  </div>;
}
