"use client";
import { useId, useState, type CSSProperties } from "react";
import { ArrowDownRight, Clock3, Layers3, ArrowRight } from "lucide-react";
import styles from "./Showcase.module.css";

export const impactMetrics=[
 {key:"reporting",label:"Tổng hợp báo cáo",unit:"giờ / tháng",before:80,after:32,workload:"4 kỳ báo cáo / tháng",context:"Cùng 4 kỳ báo cáo tồn kho, sản lượng và công nợ.",change:"Chứng từ đã ghi nhận cung cấp dữ liệu chung; bộ phận phụ trách tập trung đối chiếu và xử lý ngoại lệ.",equivalent:"48 giờ cho công việc khác · Tương đương 6 ngày công 8 giờ",rows:[{label:"Thu thập dữ liệu",before:24,after:8,basis:"4 kỳ × 6 giờ → 4 kỳ × 2 giờ"},{label:"Đối chiếu số liệu",before:32,after:16,basis:"4 kỳ × 8 giờ → 4 kỳ × 4 giờ"},{label:"Lập & gửi báo cáo",before:24,after:8,basis:"4 kỳ × 6 giờ → 4 kỳ × 2 giờ"}]},
 {key:"reentry",label:"Nhập lại chứng từ",unit:"lần / tháng",before:240,after:30,workload:"120 đơn hàng / tháng",context:"Thông tin từ 120 đơn hàng chuyển tiếp sang kho và công nợ.",change:"Đơn hàng là dữ liệu nguồn. Kịch bản giả định chỉ nhập bổ sung khi thông tin cần điều chỉnh.",equivalent:"210 lượt nhập lại được loại bỏ trong kịch bản",rows:[{label:"Từ bán hàng sang kho",before:120,after:12,basis:"120 đơn × 1 lượt → 120 đơn × 10% cần bổ sung"},{label:"Từ bán hàng sang công nợ",before:120,after:18,basis:"120 đơn × 1 lượt → 120 đơn × 15% cần bổ sung"}]},
 {key:"reconciliation",label:"Đối chiếu kho",unit:"giờ / tháng",before:40,after:12,workload:"20 ngày vận hành / tháng",context:"Cùng 20 ngày nhập xuất và đối chiếu chứng từ kho.",change:"Tra cứu chung sổ nhập xuất và trạng thái lô. Chênh lệch vẫn cần người phụ trách kiểm tra và xác nhận.",equivalent:"28 giờ cho công việc khác · Tương đương 3,5 ngày công 8 giờ",rows:[{label:"Đối chiếu chứng từ",before:24,after:6,basis:"20 ngày × 1,2 giờ → 20 ngày × 0,3 giờ"},{label:"Tìm & xử lý chênh lệch",before:16,after:6,basis:"20 ngày × 0,8 giờ → 20 ngày × 0,3 giờ"}]}
] as const;
export function calculateImpact(before:number,after:number){return {difference:before-after,percent:before===0?null:Math.round((before-after)/before*100)};}
export function ImpactExplorer(){
 const id=useId();const [selected,setSelected]=useState(0);const m=impactMetrics[selected];const impact=calculateImpact(m.before,m.after);const peak=Math.max(...m.rows.flatMap(r=>[r.before,r.after]));
 return <section id="hieu-qua" className={styles.impactSection} aria-labelledby={`${id}-title`}>
  <div className={styles.sectionHeading}><div><span className={styles.kicker}>02 / TỪ DỮ LIỆU ĐẾN QUYẾT ĐỊNH</span><h2 id={`${id}-title`}>Bớt việc lặp lại.<br/><span>Thêm thời gian tạo giá trị.</span></h2></div><span className={styles.sampleBadge}>Kịch bản giả định · Cùng khối lượng công việc</span></div>
  <div className={styles.metricTabs} role="group" aria-label="Chọn công việc so sánh">{impactMetrics.map((entry,i)=><button key={entry.key} type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)}>{entry.label}</button>)}</div>
  <div className={styles.impactGrid}>
   <div className={styles.impactControls}><span className={styles.workload}><Layers3 size={16} aria-hidden="true"/>{m.workload}</span><h3 className={styles.impactTitle}>{m.label}</h3><p className={styles.metricContext}>{m.context}</p><dl className={styles.comparisonValues}><div><dt>Cách làm rời rạc</dt><dd><strong>{m.before}</strong><span>{m.unit}</span></dd></div><div><dt>Quy trình kết nối</dt><dd><strong>{m.after}</strong><span>{m.unit}</span></dd></div></dl><div className={styles.impactResult} role="status" aria-live="polite" aria-atomic="true"><ArrowDownRight size={27} aria-hidden="true"/><strong>{impact.percent}%</strong><span>Giảm {impact.difference} {m.unit}</span></div><p className={styles.metricChange}>{m.change}</p></div>
   <div className={styles.chartPanel}>
    <div className={styles.chartHeading}><span>Thời gian & thao tác theo từng bước</span><small>{m.unit}</small></div>
    <div className={styles.compareLegend}><span><i/>Cách làm rời rạc</span><span><i/>Quy trình kết nối</span></div>
    <div className={styles.breakdown} key={m.key}>{m.rows.map((r,i)=><div className={styles.breakdownRow} key={r.label}><header><span>0{i+1}</span><strong>{r.label}</strong></header><div className={styles.compareTrack}><div style={{"--compare-width":r.before/peak} as CSSProperties}/><b>{r.before}</b></div><div className={styles.compareTrack} data-after><div style={{"--compare-width":r.after/peak} as CSSProperties}/><b>{r.after}</b></div></div>)}</div>
    <div className={styles.savedWork}><Clock3 size={22} aria-hidden="true"/><span>{m.equivalent}</span></div>
    <details className={styles.chartTable}><summary>Cơ sở tính toán<ArrowRight size={14} aria-hidden="true"/></summary><table><caption>{m.workload} · Số liệu giả định</caption><thead><tr><th scope="col">Công việc</th><th scope="col">Trước → Sau</th></tr></thead><tbody>{m.rows.map(r=><tr key={r.label}><th scope="row">{r.label}</th><td>{r.basis}</td></tr>)}<tr><th scope="row">Tổng / tháng</th><td>{m.before} → {m.after} {m.unit.split(" / ")[0]}</td></tr></tbody></table></details>
   </div>
  </div><p className={styles.method}>Mô phỏng để minh họa cách tổ chức công việc, chưa phải kết quả đo tại khách hàng. Tỷ lệ giảm = (trước − sau) / trước × 100%, làm tròn đến số nguyên.</p>
 </section>;
}
