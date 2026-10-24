"use client";
import {BusinessLink as Link} from "./BusinessLink";
import { useState } from "react";
import { ArrowUpRight, Factory, Package, CircuitBoard, Leaf, Truck, HardHat } from "lucide-react";
import { DimixoLogo } from "@/components/shared/DimixoLogo";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import { Input } from "@/components/shared/FormControls";
import companies from "@/config/businessDemoCompanies.json";
import { businessIndustries, type BusinessIndustry } from "./businessCatalog";
import styles from "./BusinessLoginEntry.module.css";
const industryIcons={metalworking:Factory,plastics_packaging:Package,electronics:CircuitBoard,food_beverage:Leaf,trading:Truck,construction:HardHat};
export function BusinessLoginEntry(){const [slug,setSlug]=useState("");return <main className={styles.page}><AmbientBackground/><header><Link prefetch={false} href="/" aria-label="DIMIXO · Trang chủ"><DimixoLogo/></Link><Link prefetch={false} href="/control-center/login">Team triển khai<ArrowUpRight size={15} aria-hidden="true"/></Link></header><section className={styles.intro}><span>DIMIXO WORKSPACE</span><h1>Đúng không gian.<br/><em>Đúng cách vận hành.</em></h1><div className={styles.custom}><Input label="Mã doanh nghiệp của bạn" value={slug} maxLength={40} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}/><Link prefetch={false} aria-disabled={slug.length<3} tabIndex={slug.length<3?-1:0} href={slug.length>=3?`/erp/${slug}/login`:"#"}>Đăng nhập<ArrowUpRight size={18} aria-hidden="true"/></Link></div></section><section aria-labelledby="experience-title" className={styles.experiences}><div className={styles.sectionTitle}><h2 id="experience-title">Sáu doanh nghiệp. Sáu cách vận hành.</h2><span>Không gian trải nghiệm</span></div><div className={styles.grid}>{companies.map(c=>{const Icon=industryIcons[c.industry as BusinessIndustry];return <Link prefetch={false} className={styles.company} href={`/erp/${c.slug}/login`} key={c.slug}><div><span className={styles.icon}><Icon size={23} aria-hidden="true"/></span><ArrowUpRight size={18} aria-hidden="true"/></div><span>{businessIndustries[c.industry as BusinessIndustry].label}</span><h3>{c.name}</h3><footer><span>{c.location}</span><strong>{c.person}</strong></footer></Link>;})}</div></section></main>;}
