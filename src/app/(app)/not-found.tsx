import Link from "next/link";

import { ErrorState } from "@/components/shared/States";

export default function NotFoundPage() {
  return (
    <ErrorState
      action={
        <Link className="button button--primary button--md" href="/dashboard">
          Về Dashboard
        </Link>
      }
      description="Đường dẫn không tồn tại hoặc bạn không có quyền truy cập."
      title="Không tìm thấy trang"
    />
  );
}
