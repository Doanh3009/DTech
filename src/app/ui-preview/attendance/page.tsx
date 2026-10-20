import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceAdminDashboard } from "@/features/attendance/components/AttendanceAdminDashboard";

export default function AttendancePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="page-main ui-preview-page"><div className="page-stack"><PageHeader title="Kiểm tra ảnh chấm công" /><AttendanceAdminDashboard ownerAccountId="attendance-preview" /></div></main>;
}
