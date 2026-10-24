import { DimixoLogo } from "@/components/shared/DimixoLogo";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Box, Check, CheckCheck, CircuitBoard, ClipboardList, Factory, Fingerprint, HardHat, LockKeyhole, Network, PackageCheck, Warehouse } from "lucide-react";
import { marketingConfig } from "@/config/marketing";
import { MarketingHeader } from "./MarketingHeader";
import { ProductShowcase } from "./ProductShowcase";
import { ImpactExplorer } from "./ImpactExplorer";
import { IndustryCases } from "./IndustryCases";
import { FeatureIllustration, type FeatureArtKind } from "./FeatureIllustration";
import styles from "./Marketing.module.css";

export function ModernLandingPage() {
  return <div className={styles.site}>
    <a className={styles.skipLink} href="#noi-dung">Đến nội dung chính</a>
    <MarketingHeader />
    <main id="noi-dung">
      <section className={`${styles.container} ${styles.hero}`} aria-label="Giới thiệu DIMIXO ERP">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><span/>PHẦN MỀM QUẢN TRỊ DOANH NGHIỆP</span>
          <h1>Vận hành liền mạch.<br/><em>Phát triển cùng bạn.</em></h1>
          <p>Kết nối sản xuất, kho, bán hàng và chi phí trong một không gian làm việc. Quy trình theo ngành, dữ liệu theo từng doanh nghiệp.</p>
          <div className={styles.heroActions}><Link className={styles.primaryButton} href={marketingConfig.trialHref}>Đăng ký dùng thử<ArrowUpRight aria-hidden="true" size={18}/></Link><a className={styles.secondaryButton} href="#giai-phap">Khám phá giải pháp<ArrowRight aria-hidden="true" size={17}/></a></div>
          <div className={styles.heroChecks}><span><Check size={15} aria-hidden="true"/>Chọn module phù hợp</span><span><Check size={15} aria-hidden="true"/>Phân quyền rõ ràng</span></div>
        </div>
        <ProductShowcase/>
      </section>
      <div className={styles.industryStrip}><div className={styles.container}><span>THIẾT KẾ CHO CÁCH BẠN VẬN HÀNH</span>{[{ icon: Factory, label: "Cơ khí" }, { icon: Box, label: "Nhựa & bao bì" }, { icon: CircuitBoard, label: "Điện tử" }, { icon: PackageCheck, label: "Thực phẩm" }, { icon: Warehouse, label: "Thương mại" }, { icon: HardHat, label: "Xây dựng" }].map(({ icon: Icon, label }) => <strong key={label}><Icon size={18} aria-hidden="true" />{label}</strong>)}</div></div>
      <section className={`${styles.container} ${styles.solutionSection}`} id="giai-phap">
        <div className={styles.sectionIntro}><span className={styles.eyebrow}>01 / NỀN TẢNG QUẢN TRỊ</span><h2>Bớt rời rạc.<br />Thêm kết nối.</h2><p>Thông tin có ngữ cảnh. Quy trình có người phụ trách. Mỗi bộ phận làm việc trong phạm vi được phân quyền.</p></div>
        <div className={styles.capabilityGrid}>{[{ icon: Factory, name: "Sản xuất & định mức", tag: "SẢN XUẤT", kind: "production" }, { icon: Warehouse, name: "Kho & vật tư", tag: "NGUỒN LỰC", kind: "inventory" }, { icon: ClipboardList, name: "Dự án & công trường", tag: "VẬN HÀNH", kind: "project" }, { icon: CheckCheck, name: "Bán hàng & công nợ", tag: "KINH DOANH", kind: "sales" }].map(({ icon: Icon, name, tag, kind }, index) => <div className={styles.capability} key={name}><span className={styles.capabilityIndex}>0{index + 1}</span><FeatureIllustration kind={kind as FeatureArtKind}/><small>{tag}</small><h3><Icon size={19} strokeWidth={1.5} aria-hidden="true"/>{name}</h3></div>)}</div>
        <div className={styles.principles}><span><Network size={19} aria-hidden="true" />Quy trình kết nối</span><span><Fingerprint size={19} aria-hidden="true" />Truy vết thao tác</span><span><LockKeyhole size={19} aria-hidden="true" />Phân quyền rõ ràng</span></div>
      </section>
      <div className={styles.container}><ImpactExplorer /><IndustryCases /></div>
      <section className={`${styles.container} ${styles.deploymentSection}`} id="trien-khai"><div className={styles.sectionIntro}><span className={styles.eyebrow}>04 / ĐỒNG HÀNH TRIỂN KHAI</span><h2>Phù hợp trước.<br />Mở rộng sau.</h2><p>Một nền tảng chung, cấu hình theo doanh nghiệp. Thống nhất phạm vi và kiểm chứng quy trình trước khi đưa vào vận hành.</p></div><ol className={styles.deploymentSteps}>{[{title:"Khảo sát nhu cầu",outputs:["Luồng chứng từ hiện tại","Danh mục & dữ liệu đầu vào","Phạm vi gói ngành"]},{title:"Cấu hình ERP",outputs:["Module & tài khoản","Danh mục, định mức, kho","Vai trò truy cập"]},{title:"Dùng thử & đối soát",outputs:["Một quy trình đầu đến cuối","Số dư kho & công nợ","Chi phí & sản lượng"]},{title:"Bàn giao vận hành",outputs:["Đường dẫn & tài khoản","Dữ liệu được xác nhận","Đầu mối hỗ trợ"]}].map((stage, index) => <li key={stage.title}><span>0{index + 1}</span><h3>{stage.title}</h3><ul>{stage.outputs.map(output=><li key={output}>{output}</li>)}</ul>{index < 3 ? <ArrowRight aria-hidden="true" size={19} /> : <Check aria-hidden="true" size={19} />}</li>)}</ol></section>
      <section className={`${styles.container} ${styles.faqSection}`}><div><span className={styles.eyebrow}>THÔNG TIN THÊM</span><h2>Những điều bạn<br />có thể đang quan tâm.</h2></div><div className={styles.faqList}>{marketingConfig.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div></section>
      <section className={styles.ctaSection}><div className={styles.container}><span className={styles.eyebrow}>BƯỚC TIẾP THEO</span><h2>Rõ từng quyết định.<br />Vững mỗi bước đi.</h2><Link className={styles.lightButton} href={marketingConfig.trialHref}>Trao đổi & đăng ký dùng thử<ArrowUpRight aria-hidden="true" size={19} /></Link><span className={styles.ctaNote}>DIMIXO tiếp nhận nhu cầu và cấp tài khoản dùng thử riêng.</span></div></section>
    </main>
    <footer className={`${styles.container} ${styles.footer}`}><Link className={styles.brand} href="/"><DimixoLogo/></Link><span>Quản trị doanh nghiệp. Theo cách của bạn.</span><Link href="/login">Đăng nhập hệ thống<ArrowUpRight aria-hidden="true" size={15} /></Link><small>© {new Date().getFullYear()} DIMIXO</small></footer>
  </div>;
}
