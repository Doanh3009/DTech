"use client";

import { useEffect } from "react";

import { Button } from "@/components/shared/Button";

export default function AppRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("app_route_error", { digest: error.digest });
  }, [error]);

  return (
    <section className="route-error" role="alert">
      <h1>Không thể tải nội dung này</h1>
      <p>Màn hình làm việc vẫn được giữ. Bạn có thể thử tải lại phần nội dung đang lỗi.</p>
      {error.digest ? <p className="route-error__reference">Mã tham chiếu: <code>{error.digest}</code></p> : null}
      <Button onClick={reset} variant="primary">Thử lại</Button>
    </section>
  );
}
