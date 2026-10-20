import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type LayoutProps = { children: ReactNode; className?: string };

export function PageContainer({ children, className }: LayoutProps) {
  return <div className={cn("page-container", className)}>{children}</div>;
}

/** The only content-width wrapper permitted for new pages. */
export function PageContent({ children, className }: LayoutProps) {
  return <div className={cn("page-content", className)}>{children}</div>;
}

export function ListPageLayout({ children, className }: LayoutProps) {
  return <div className={cn("list-page-layout", "screen-template--data", className)}>{children}</div>;
}

export function FormPageLayout({ children, className }: LayoutProps) {
  return <div className={cn("form-page-layout", "screen-template--process", className)}>{children}</div>;
}

export function DetailPageLayout({ children, className }: LayoutProps) {
  return <div className={cn("detail-page-layout", "screen-template--detail", className)}>{children}</div>;
}

export function SplitView({ children, className }: LayoutProps) {
  return <div className={cn("split-view", className)}>{children}</div>;
}

export function DetailPanel({ children, className }: LayoutProps) {
  return <aside className={cn("detail-panel", className)}>{children}</aside>;
}

export function DataSurface({ children, className }: LayoutProps) {
  return <section className={cn("data-surface", "data-surface--workspace", className)}>{children}</section>;
}

export function DataManagementWorkspace({ children, className }: LayoutProps) {
  return (
    <section className={cn("data-management-workspace", className)}>
      {children}
    </section>
  );
}

export function Section({ children, className }: LayoutProps) {
  return <section className={cn("section", className)}>{children}</section>;
}

export const PageSection = Section;

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <header className="section-header"><h2>{title}</h2>{action}</header>;
}

export function DashboardGrid({ children, className }: LayoutProps) {
  return <div className={cn("dashboard-grid", className)}>{children}</div>;
}

export function ContentGrid({ children, className }: LayoutProps) {
  return <div className={cn("content-grid", className)}>{children}</div>;
}

export function FullWidthWorkspace({ children, className }: LayoutProps) {
  return <div className={cn("full-width-workspace", className)}>{children}</div>;
}

export function NarrowFormContainer({ children, className }: LayoutProps) {
  return <div className={cn("narrow-form-container", className)}>{children}</div>;
}

export function DashboardPageTemplate({ children, className }: LayoutProps) {
  return <div className={cn("dashboard-page", className)}>{children}</div>;
}

export const ListPageTemplate = ListPageLayout;
export const FormPageTemplate = FormPageLayout;
export const DetailPageTemplate = DetailPageLayout;

export function ReportPageTemplate({ children, className }: LayoutProps) {
  return <div className={cn("report-page-layout", className)}>{children}</div>;
}
