import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function WorkbenchLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("workbench-layout", className)}>{children}</div>;
}

export function CommandBar({ children, className, label = "Lệnh thao tác" }: { children: ReactNode; className?: string; label?: string }) {
  return <div aria-label={label} className={cn("command-bar", className)} role="toolbar">{children}</div>;
}

export function WorkCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("work-canvas", className)}>{children}</section>;
}

export function Inspector({ children, className, title }: { children: ReactNode; className?: string; title: string }) {
  return <aside aria-label={title} className={cn("workbench-inspector", className)}><h2>{title}</h2>{children}</aside>;
}

export function OperationalSection({ children, className, title, meta }: { children: ReactNode; className?: string; title: string; meta?: ReactNode }) {
  return (
    <section className={cn("operational-section", className)}>
      <header className="operational-section__header">
        <h2>{title}</h2>
        {meta ? <div className="operational-section__meta">{meta}</div> : null}
      </header>
      <div className="operational-section__body">{children}</div>
    </section>
  );
}
