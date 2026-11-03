import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessAuthForm } from "@/features/business/BusinessAuthForm";
import { businessSlug } from "@/features/business/businessSchemas";
import companies from "@/config/businessDemoCompanies.json";
import { businessIndustries, type BusinessIndustry } from "@/features/business/businessCatalog";
import { DimixoLogo } from "@/components/shared/DimixoLogo";
import styles from "@/features/business/BusinessAuth.module.css";
export const metadata={title:"Đăng nhập ERP",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!businessSlug.safeParse(slug).success)notFound();const company=companies.find(c=>c.slug===slug);return <main className={styles.page}><div className={styles.card}><Link href="/" aria-label="DIMIXO · Trang chủ"><DimixoLogo/></Link><div className={styles.identity}><span className={styles.industry}>{company?businessIndustries[company.industry as BusinessIndustry].label:slug}</span><h1>{company?.name??"Đăng nhập doanh nghiệp"}</h1></div><BusinessAuthForm slug={slug}/><footer className={styles.footer}><Link href="/trai-nghiem">Chọn doanh nghiệp khác</Link><Link href="/">Trang chủ</Link></footer></div></main>;}
