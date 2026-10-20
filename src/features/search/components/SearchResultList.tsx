"use client";

import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, File, FileText, MapPin, Package, Ship, UserRound } from "lucide-react";

import type { SearchResult } from "@/features/search/types";
import { StatusBadge } from "@/components/shared/StatusBadge";

const icons = {
  user: UserRound,
  briefcase: BriefcaseBusiness,
  "map-pin": MapPin,
  package: Package,
  "file-text": FileText,
  ship: Ship,
  "file-contract": FileText,
  calendar: CalendarDays,
  "calendar-days": CalendarDays,
  file: File
};

export function recordRecentResult(result: SearchResult) {
  void fetch("/api/v1/recent-items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entityType: result.entityType, entityId: result.entityId, title: result.title, subtitle: result.subtitle, deepLink: result.deepLink }),
    keepalive: true
  }).catch(() => undefined);
}

export function SearchResultList({ results, activeIndex, idPrefix = "search-result", indexOffset = 0, onSelect }: { results: SearchResult[]; activeIndex?: number; idPrefix?: string; indexOffset?: number; onSelect?: (result: SearchResult) => void }) {
  return (
    <ul className="global-search-results" role="listbox">
      {results.map((result, index) => {
        const Icon = icons[result.icon as keyof typeof icons] ?? File;
        return (
          <li aria-selected={activeIndex === index} className={activeIndex === index ? "is-active" : undefined} id={`${idPrefix}-${index + indexOffset}`} key={`${result.entityType}-${result.entityId}`} role="option">
            <Link href={result.deepLink} onClick={() => { recordRecentResult(result); onSelect?.(result); }}>
              <span className="search-result-icon"><Icon aria-hidden="true" size={18} /></span>
              <span className="search-result-copy"><strong>{result.title}</strong><small>{[result.reference, result.subtitle].filter(Boolean).join(" · ")}</small></span>
              {result.status ? <StatusBadge>{result.status}</StatusBadge> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
