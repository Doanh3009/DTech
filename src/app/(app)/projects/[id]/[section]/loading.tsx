"use client";

import { usePathname } from "next/navigation";

import { Skeleton } from "@/components/shared/States";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function Loading() {
  const section = usePathname().split("/").at(-1) ?? "progress";
  const rowCount = section === "team" ? 5 : section === "profile" || section === "documents" ? 4 : 6;
  return (
    <div aria-label="Đang tải không gian làm việc gói" className="package-workspace-skeleton" data-section={section} role="status">
      <LoadingSpinner />
      <section><Skeleton /><Skeleton /><Skeleton /></section>
      <nav>{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} />)}</nav>
      <main>
        <header><Skeleton /><Skeleton /></header>
        <div>{Array.from({ length: rowCount }).map((_, index) => <article className="package-workspace-skeleton__row" key={index}><Skeleton /><span><Skeleton /><Skeleton /></span><Skeleton /></article>)}</div>
      </main>
    </div>
  );
}
