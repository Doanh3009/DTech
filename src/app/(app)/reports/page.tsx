import Link from "next/link";import { PageHeader } from "@/components/shared/PageHeader";import { ReportCenter } from "@/features/timesheets/components/ReportCenter";
export default function Page(){return <div className="page-stack"><PageHeader title="Báo cáo" action={<Link className="button button--secondary" href="/settings/export-templates">Mẫu xuất</Link>}/><ReportCenter/></div>;}
