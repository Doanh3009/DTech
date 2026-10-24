import { DimixoLogo } from "@/components/shared/DimixoLogo";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { marketingConfig } from "@/config/marketing";
import styles from "./Marketing.module.css";

export function MarketingHeader() {
  return <header className={styles.header}><div className={styles.headerInner}>
    <Link aria-label="DIMIXO ERP — Trang chủ" className={styles.brand} href="/"><DimixoLogo/></Link>
    <nav aria-label="Giới thiệu sản phẩm" className={styles.navigation}>{marketingConfig.navigation.map((item) => <a href={item.href.startsWith("#")?`/${item.href}`:item.href} key={item.href}>{item.label}</a>)}</nav>
    <div className={styles.headerActions}><Link className={styles.loginLink} href="/login">Đăng nhập</Link><Link className={styles.primaryButton} href={marketingConfig.trialHref}>Dùng thử<ArrowUpRight aria-hidden="true" size={16} /></Link></div>
  </div></header>;
}
