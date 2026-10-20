import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AttendancePhotoReviewDemo } from "@/features/attendance/components/AttendancePhotoReviewDemo";

export default function AttendancePhotoDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="page-main ui-preview-page"><div className="page-stack"><PageHeader meta={<StatusBadge tone="warning">Dữ liệu mẫu</StatusBadge>} title="Kiểm tra ảnh chấm công" /><AttendancePhotoReviewDemo /></div></main>;
}
