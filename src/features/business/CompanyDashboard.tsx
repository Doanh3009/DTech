"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet, ChartNoAxesCombined, Clock3, CircleAlert, PackageCheck, ChevronRight, ListChecks } from "lucide-react";
import { businessEntities, type BusinessIndustry, type EntityKind } from "./businessCatalog";
import { dashboardDate, dashboardMoney as money, dashboardNumber as number, type CompanyDashboardSnapshot } from "./businessDashboardData";
import styles from "./CompanyDashboard.module.css";

const operationTitles:Record<BusinessIndustry,string>={metalworking:"Tiến độ gia công",plastics_packaging:"Lệnh sản xuất & khuôn",electronics:"Lắp ráp & kiểm thử",food_beverage:"Sản xuất theo mẻ",trading:"Giá trị hàng đã giao",construction:"Ngân sách công trình"};
const entityLabel=(kind:string)=>businessEntities[kind as EntityKind]?.label??kind;

/** Same operational components in ERP and public previews; previews receive public fixtures only. */
export function CompanyDashboard({data:d,industry,baseHref,compact=false,features}:{data:CompanyDashboardSnapshot;industry:BusinessIndustry;baseHref?:string;compact?:boolean;features?:readonly string[]}){
 const workFeature=features?.includes("projects")?"projects":features?.includes("production")?"production":features?.includes("sales")?"sales":features?null:industry==="construction"?"projects":industry==="trading"?"sales":"production";const f=d.finance;const peak=Math.max(1,...d.trend.flatMap(b=>[b.cash_in,b.cash_out]));
 const unit=peak>=1e6?1e6:peak>=1e3?1e3:1;const unitLabel=unit===1e6?"triệu đồng":unit===1e3?"nghìn đồng":"đồng";
 const link=(kind:string,code?:string)=>`${baseHref}/${kind}${code?`?q=${encodeURIComponent(code)}`:""}`;
 const content=(kind:string,code:string|undefined,children:ReactNode,className:string)=>baseHref?<Link prefetch={false} className={className} href={link(kind,code)}>{children}<ChevronRight size={15} aria-hidden="true"/></Link>:<div className={className}>{children}</div>;
 return <div className={styles.dashboard} data-compact={compact}>
  {f?<section className={styles.metrics} aria-label="Chỉ số doanh nghiệp">
   {[
    {label:"Doanh thu thuần",value:f.revenue,meta:`${dashboardDate(d.from)} – ${dashboardDate(d.to)} · Trước thuế`,tone:"blue",Icon:ChartNoAxesCombined},
    {label:"Tiền mặt & ngân hàng",value:f.cashBalance,meta:`Số dư hiện tại · ${dashboardDate(d.asOf)}`,tone:f.cashBalance<0?"danger":"green",Icon:Wallet},
    {label:"Còn phải thu",value:f.receivables,meta:`Quá hạn ${money(f.overdue)} đ`,tone:f.overdue>0?"amber":"violet",Icon:Clock3},
    {label:"Còn phải trả",value:f.payables,meta:`Công nợ hiện tại · ${dashboardDate(d.asOf)}`,tone:"violet",Icon:ArrowUpRight}
   ].map(({label,value,meta,tone,Icon})=><article className={styles.metric} data-tone={tone} key={label}><div><span>{label}</span><Icon size={18} aria-hidden="true"/></div><strong title={`${number(value)} đồng`}>{money(value)}<small>đ</small></strong><span className={styles.metricMeta}>{meta}</span></article>)}
  </section>:null}
  <div className={styles.mainGrid}>
   {f?<section className={styles.panel} aria-label="Dòng tiền trong kỳ">
    <header className={styles.panelHeader}><div><span className={styles.eyebrow}>DÒNG TIỀN TRONG KỲ</span><h2>Thu & chi thực tế</h2></div><span className={styles.net} data-negative={f.cashIn-f.cashOut<0}>{f.cashIn-f.cashOut>=0?"+":""}{money(f.cashIn-f.cashOut)} đ</span></header>
    <div className={styles.flowTotals}><span><i data-in/><ArrowDownLeft size={14} aria-hidden="true"/>Thu <b>{money(f.cashIn)} đ</b></span><span><i/><ArrowUpRight size={14} aria-hidden="true"/>Chi <b>{money(f.cashOut)} đ</b></span></div>
    <div className={styles.chart} role="img" aria-label={`Thu ${number(f.cashIn)} đồng; chi ${number(f.cashOut)} đồng. Đơn vị trục: ${unitLabel}. Chi tiết trong bảng số liệu.`}>
     <div className={styles.axis}><span>{number(peak/unit)}</span><span>{number(peak/2/unit)}</span><span>0</span></div>
     <div className={styles.plot}>{d.trend.map(b=><div className={styles.bucket} key={b.starts_on}><div className={styles.pair}><div data-in style={{height:`${b.cash_in/peak*100}%`}}><span>{number(b.cash_in/unit)}</span></div><div style={{height:`${b.cash_out/peak*100}%`}}><span>{number(b.cash_out/unit)}</span></div></div><span>{b.starts_on.slice(8)}/{b.starts_on.slice(5,7)}–{b.ends_on.slice(8)}</span></div>)}</div>
    </div>
    <div className={styles.chartFoot}><span>{unitLabel} · Nhóm 7 ngày</span><span>Không gồm chuyển tiền nội bộ</span></div>
    {!compact?<details className={styles.dataDetails}><summary>Bảng số liệu</summary><div className={styles.tableWrap}><table><caption>Dòng tiền & doanh thu · đồng</caption><thead><tr><th scope="col">Ngày</th><th scope="col">Thu</th><th scope="col">Chi</th><th scope="col">Doanh thu thuần</th></tr></thead><tbody>{d.trend.map(b=><tr key={b.starts_on}><th scope="row">{dashboardDate(b.starts_on)} – {dashboardDate(b.ends_on)}</th><td>{number(b.cash_in)}</td><td>{number(b.cash_out)}</td><td>{number(b.revenue)}</td></tr>)}</tbody></table></div></details>:null}
   </section>:null}
   <section className={styles.panel} aria-label="Cần xử lý">
    <header className={styles.panelHeader}><div><span className={styles.eyebrow}>THEO DÕI HÔM NAY</span><h2>Cần xử lý</h2></div><span className={styles.alertCount}><CircleAlert size={15} aria-hidden="true"/>{d.alerts.total}</span></header>
    <div className={styles.alertList}>{d.alerts.items.length?d.alerts.items.slice(0,compact?3:6).map(r=><div key={r.kind+r.code} className={styles.alert} data-tone={r.tone}>{content(r.kind,r.code,<><i/><div><strong>{r.name}</strong><span>{r.state}{r.date?` · ${dashboardDate(r.date)}`:""}</span></div>{r.amount!==null?<b>{money(r.amount)} đ</b>:null}</>,styles.alertLink)}</div>):<div className={styles.empty}><PackageCheck size={24} aria-hidden="true"/>Không có cảnh báo</div>}</div>
    {d.stock?<div className={styles.stock}><span><b>{d.stock.lots}</b>Lô có tồn</span><span data-warning={d.stock.blocked>0}><b>{d.stock.blocked}</b>Chặn chất lượng</span><span data-warning={d.stock.expiring+d.stock.expired>0}><b>{d.stock.expiring+d.stock.expired}</b>Hết / sắp hết hạn</span></div>:null}
   </section>
  </div>
  <div className={styles.bottomGrid}>
   {workFeature?<section className={styles.panel} aria-label={operationTitles[industry]}>
    <header className={styles.panelHeader}><div><span className={styles.eyebrow}>VẬN HÀNH HIỆN TẠI</span><h2>{operationTitles[industry]}</h2></div>{baseHref?<Link prefetch={false} href={`${baseHref}/module/${workFeature}`}>Xem tất cả <ArrowUpRight size={14} aria-hidden="true"/></Link>:null}</header>
    <div className={styles.workList}>{d.work.length?d.work.slice(0,compact?1:6).map(r=>{const project=r.kind==="projects";const percent=r.target>0?Math.round(r.actual/r.target*100):null;const tone=percent!==null&&percent>100?"danger":percent===100?"green":"blue";return <article key={r.id} className={styles.workRow}><div className={styles.workHeading}>{content(r.kind,r.code,<strong>{r.name}</strong>,styles.workLink)}<span data-tone={tone}>{project?"Chi phí / ngân sách":r.status==="completed"?"Hoàn thành":"Đang thực hiện"}</span></div><div className={styles.workNumbers}><span>{r.unit==="đ"?`${money(r.actual)} / ${money(r.target)} đ`:`${number(r.actual)} / ${number(r.target)} ${r.unit}`}</span><b>{percent===null?"Chưa có ngân sách":`${percent}%`}</b></div><progress value={Math.min(100,Math.max(0,percent??0))} max={100} data-tone={tone} aria-label={`${r.name}: ${project?"chi phí trên ngân sách":"hoàn thành"} ${percent??0}%`}/>{project?<div className={styles.workMeta}><span>Tiến độ báo cáo</span><b>{r.progress===null||r.progress===undefined?"Chưa cập nhật":`${number(r.progress)}%`}</b></div>:r.cost!==undefined?<div className={styles.workMeta}><span>Chi phí vật tư, nhân công & máy</span><b>{money(r.cost)} đ</b></div>:null}<div className={styles.workMeta}>{industry==="plastics_packaging"?<><span>Khuôn {r.mold_code??"—"}</span><b>Phế {number(r.scrap??0)} {r.unit}</b></>:industry==="electronics"?<><span>Liên kết truy xuất</span><b>{r.trace_count??0} liên kết</b></>:industry==="food_beverage"?<><span>Hạn dùng thành phẩm gần nhất</span><b>{r.expires_on?dashboardDate(r.expires_on):"Chưa nhập lô"}</b></>:industry==="metalworking"?<><span>Giờ nhân công đã ghi nhận</span><b>{number(r.labor_hours??0)} giờ</b></>:null}</div></article>;}):<div className={styles.empty}>Chưa có dữ liệu vận hành</div>}</div>
   </section>:null}
   <section className={styles.panel} aria-label="Chứng từ đang xử lý"><header className={styles.panelHeader}><div><span className={styles.eyebrow}>QUY TRÌNH CHỨNG TỪ</span><h2>Đang xử lý</h2></div><ListChecks size={20} aria-hidden="true"/></header><div className={styles.queueList}>{d.queues.length?d.queues.slice(0,compact?3:6).map(q=><div key={q.kind}>{content(q.kind,undefined,<><div><strong>{entityLabel(q.kind)}</strong><span>{q.review?`${q.review} chờ duyệt`:`${q.total} bản nháp`}</span></div><b>{q.total}</b></>,styles.queue)}</div>):<div className={styles.empty}><PackageCheck size={24} aria-hidden="true"/>Không có chứng từ nháp</div>}</div></section>
  </div>
 </div>;
}
