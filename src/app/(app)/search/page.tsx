import { Suspense } from "react";

import { SearchCenter } from "@/features/search/components/SearchCenter";

export default function Page() {
  return <Suspense fallback={<div className="search-state">Đang tải…</div>}><SearchCenter /></Suspense>;
}
