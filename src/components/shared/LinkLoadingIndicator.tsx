"use client";

import { useLinkStatus } from "next/link";

import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export function LinkLoadingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-label="Đang mở trang" role="status"><LoadingSpinner inline /></span>;
}
