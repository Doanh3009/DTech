import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function Loading() {
  return <div aria-label="Đang tải danh sách nhân viên" className="page-stack" role="status">
    <LoadingSpinner />
    <PageHeader title="Nhân viên" />
    <div aria-hidden="true" className="filter-bar"><div className="filter-bar__controls"><span className="skeleton toolbar-skeleton" /></div></div>
    <div aria-hidden="true" className="data-table-shell employee-list-loading">
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="skeleton" />
    </div>
  </div>;
}
