import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/LandingPage";
import { redirect } from "next/navigation";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "DIMIXO ERP — Quản trị doanh nghiệp theo cách của bạn" },
  description: "Kết nối con người, quy trình và dữ liệu. Khám phá DIMIXO ERP, mô phỏng hiệu quả chuyển đổi số và các tình huống triển khai theo ngành."
};

export default function HomePage() { if(!controlCenterEnabled())redirect("/login");return <LandingPage />; }
