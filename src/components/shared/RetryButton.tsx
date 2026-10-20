"use client";

import { Button } from "@/components/shared/Button";

export function RetryButton() {
  return <Button onClick={() => window.location.reload()} variant="secondary">Thử lại</Button>;
}

