"use client";

import { LoaderCircle } from "lucide-react";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";

import styles from "./LoadingSpinner.module.css";

/** Shared loading indicator for route and data loading states. */
export function LoadingSpinner({ inline = false }: { inline?: boolean } = {}) {
  useLoadingActivity(true, inline ? "action" : "page");
  if (inline) {
    return <LoaderCircle aria-hidden="true" className={`${styles.icon} ${styles.inline}`} size={18} strokeWidth={2.5} />;
  }
  return null;
}
