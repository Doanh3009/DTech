"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchResultList } from "@/features/search/components/SearchResultList";
import type { GlobalSearchResponse, RecentEntity, SearchEntityType, SearchResult } from "@/features/search/types";

const tabs: Array<{ label: string; types?: SearchEntityType[] }> = [
  { label: "Tất cả" },
  { label: "Nhân viên", types: ["employee"] },
  { label: "Dự án", types: ["project", "worksite"] },
  { label: "Kho", types: ["warehouse_item", "warehouse_document"] },
  { label: "Lô hàng", types: ["shipment", "import_contract"] },
  { label: "Tài liệu", types: ["document"] }
];

interface ApiBody { ok: boolean; data?: GlobalSearchResponse; error?: { message: string }; }
interface RecentBody { ok: boolean; data?: { items: RecentEntity[] }; }

export function SearchCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlTab = Math.max(0, Math.min(Number(searchParams.get("tab") ?? 0) || 0, tabs.length - 1));
  const cursor = Math.max(0, Number(searchParams.get("cursor") ?? 0) || 0);
  const [query, setQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<RecentEntity[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchSequence = useRef(0);
  const tab = tabs[urlTab];
  const searchLoading = loading && urlQuery.trim().length >= 2;
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ q: urlQuery, limit: "20", cursor: String(cursor) });
    if (tab.types) params.set("types", tab.types.join(","));
    return `/api/v1/search?${params}`;
  }, [cursor, tab.types, urlQuery]);

  useEffect(() => { void fetch("/api/v1/recent-items", { cache: "no-store" }).then((response) => response.json() as Promise<RecentBody>).then((body) => setRecent(body.data?.items ?? [])).catch(() => setRecent([])); }, []);
  useEffect(() => {
    const requestId = ++searchSequence.current;
    if (urlQuery.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      void fetch(requestUrl, { cache: "no-store", signal: controller.signal }).then(async (response) => {
        const body = await response.json() as ApiBody;
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tìm kiếm.");
        if (requestId === searchSequence.current) { setResults(body.data.results); setNextCursor(body.data.nextCursor); }
      }).catch((reason: unknown) => { if (requestId === searchSequence.current && !(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Không thể tìm kiếm."); }).finally(() => { if (requestId === searchSequence.current) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [requestUrl, urlQuery]);

  function updateUrl(nextQuery: string, nextTab = urlTab, nextCursor = 0) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextTab) params.set("tab", String(nextTab));
    if (nextCursor) params.set("cursor", String(nextCursor));
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  const recentResults: SearchResult[] = recent.map((item) => ({ ...item, icon: "file", score: 0 }));
  return (
    <div className="search-center page-stack">
      <PageHeader title="Tìm kiếm toàn hệ thống" />
      <form className="search-center-form" onSubmit={(event) => { event.preventDefault(); updateUrl(query, urlTab, 0); }} role="search"><Search aria-hidden="true" size={20} /><input aria-label="Từ khóa tìm kiếm" autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Nhân viên, dự án, lô hàng, chứng từ..." type="search" value={query} /><Button type="submit" variant="primary">Tìm kiếm</Button></form>
      <div aria-label="Loại kết quả" className="search-tabs" role="tablist">{tabs.map((item, index) => <button aria-selected={urlTab === index} className={urlTab === index ? "is-active" : undefined} key={item.label} onClick={() => updateUrl(urlQuery, index, 0)} role="tab" type="button">{item.label}</button>)}</div>
      <Card className="search-results-card">
        {urlQuery.trim().length < 2 ? <>{recentResults.length ? <><h3>Gần đây</h3><SearchResultList results={recentResults} /></> : <div className="search-state">Nhập ít nhất 2 ký tự.</div>}</> : searchLoading ? <div className="search-state">Đang tìm…</div> : error ? <div className="search-state search-state--error">{error}</div> : results.length ? <SearchResultList results={results} /> : <div className="search-state">Không tìm thấy kết quả cho “{urlQuery}”.<small>Kiểm tra lại mã hoặc tên.</small></div>}
      </Card>
      {!searchLoading && (cursor > 0 || nextCursor) ? <div className="search-pagination"><Button disabled={cursor === 0} onClick={() => updateUrl(urlQuery, urlTab, Math.max(0, cursor - 20))}>Trang trước</Button><span>Trang {Math.floor(cursor / 20) + 1}</span><Button disabled={!nextCursor} onClick={() => updateUrl(urlQuery, urlTab, Number(nextCursor))}>Trang sau</Button></div> : null}
    </div>
  );
}
