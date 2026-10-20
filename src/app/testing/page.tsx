import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TestAccountPicker } from "@/features/testing/TestAccountPicker";
import styles from "@/features/testing/TestAccountPicker.module.css";
import { testToolsAvailable } from "@/lib/testing/policy.mjs";

export const metadata: Metadata = { title: "Kiểm thử hệ thống", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function TestingPage() {
  const environment = testToolsAvailable();
  if (!environment) notFound();
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div><span className={styles.brand}>CHÂU TUẤN</span><h1>Kiểm thử hệ thống</h1></div>
        <Link className={styles.pageLink} href="/login">Đăng nhập</Link>
      </header>
      <TestAccountPicker environment={environment.environment} standalone />
    </div>
  </main>;
}
