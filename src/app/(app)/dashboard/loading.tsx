import { Skeleton } from "@/components/shared/States";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function Loading() {
  return (
    <div aria-label="Đang tải Dashboard" className="dashboard-route-skeleton" role="status">
      <LoadingSpinner />
      <header>
        <span><Skeleton /><Skeleton /></span>
        <Skeleton />
      </header>
      <nav>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</nav>
      <section>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</section>
      <main>
        <article>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</article>
        <aside><Skeleton /><Skeleton /><Skeleton /></aside>
      </main>
    </div>
  );
}
