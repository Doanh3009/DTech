import type { SearchResult } from "@/features/search/types";

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim().replace(/\s+/g, " ");
}

export function searchScore(query: string, result: Pick<SearchResult, "title" | "reference" | "subtitle">): number {
  const normalized = normalizeSearchText(query);
  const reference = normalizeSearchText(result.reference ?? "");
  const title = normalizeSearchText(result.title);
  const subtitle = normalizeSearchText(result.subtitle ?? "");
  if (reference && reference === normalized) return 1_000;
  if (title === normalized) return 900;
  if (reference.startsWith(normalized)) return 760;
  if (title.startsWith(normalized)) return 680;
  if (reference.includes(normalized)) return 560;
  if (title.includes(normalized)) return 460;
  if (subtitle.includes(normalized)) return 320;
  return 100;
}

export function rankSearchResults(query: string, results: SearchResult[], recentKeys: ReadonlySet<string> = new Set()): SearchResult[] {
  return results
    .map((result) => ({ ...result, score: searchScore(query, result) + (recentKeys.has(`${result.entityType}:${result.entityId}`) ? 35 : 0) }))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "vi"));
}
