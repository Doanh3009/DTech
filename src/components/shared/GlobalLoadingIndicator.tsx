"use client";

import { LoaderCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getLoadingSnapshot, getServerLoadingSnapshot, subscribeToLoading } from "@/lib/ui/loadingActivity";
import styles from "./LoadingSpinner.module.css";

export function GlobalLoadingIndicator() {
  const pending = useSyncExternalStore(subscribeToLoading, getLoadingSnapshot, getServerLoadingSnapshot);
  if (!pending.page && !pending.action) return null;
  return createPortal(
    <div aria-label="Đang xử lý" aria-live="polite" className={styles.position} data-loading-mode={pending.page ? "page" : "action"} data-ui="loading-spinner" role="status">
      <div className={styles.surface}><LoaderCircle aria-hidden="true" className={styles.icon} size={28} strokeWidth={2.5} /></div>
      <span className="sr-only">Đang xử lý</span>
    </div>,
    document.body
  );
}
