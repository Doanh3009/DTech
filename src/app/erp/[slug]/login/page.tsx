import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessAuthForm } from "@/features/business/BusinessAuthForm";
import { businessSlug } from "@/features/business/businessSchemas";
import companies from "@/config/businessDemoCompanies.json";
import { businessIndustries, type BusinessIndustry } from "@/features/business/businessCatalog";
import { DimixoLogo } from "@/components/shared/DimixoLogo";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import styles from "@/features/crm/Crm.module.css";
export const metadata={title:"Đăng nhập ERP",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!businessSlug.safeParse(slug).success)notFound();const company=companies.find(c=>c.slug===slug);return <main className={styles.login}><AmbientBackground/><div className={styles.loginCard}><DimixoLogo/><span className={styles.eyebrow}>{company?businessIndustries[company.industry as BusinessIndustry].label:slug}</span><h1>{company?.name??"Đăng nhập doanh nghiệp"}</h1><BusinessAuthForm slug={slug}/><Link className={styles.link} href="/trai-nghiem">Chọn doanh nghiệp khác</Link></div></main>;}
