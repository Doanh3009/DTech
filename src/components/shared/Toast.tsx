import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "warning" | "error" | "info";

export interface ToastProps {
  title: string;
  description?: string;
  tone?: ToastTone;
}

export function Toast({ title, description, tone = "info" }: ToastProps) {
  return (
    <div className={cn("toast", `toast--${tone}`)} role="status">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="toast-viewport">
      {children}
    </div>
  );
}
