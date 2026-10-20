import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";
import { normalizeSearchText, rankSearchResults } from "@/features/search/ranking";
import type { GlobalSearchResponse, SearchEntityType, SearchProvider, SearchResult } from "@/features/search/types";

const timeoutMs = 1_500;

function withTimeout<T>(value: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SEARCH_PROVIDER_TIMEOUT")), timeoutMs);
    void value.then(
      (result) => { clearTimeout(timer); resolve(result); },
      (error: unknown) => { clearTimeout(timer); reject(error); }
    );
  });
}

export async function globalSearchCore(user: AuthenticatedUser, input: { query: string; types?: SearchEntityType[]; limit?: number; offset?: number }, providers: SearchProvider[], recentKeys: ReadonlySet<string> = new Set()): Promise<GlobalSearchResponse> {
  const query = input.query.trim();
  if (normalizeSearchText(query).length < 2) throw new AppError("VALIDATION_ERROR", "Nhập ít nhất 2 ký tự.");
  const perProviderLimit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const selected = providers.filter((provider) => provider.requiredAny.some((permission) => can(user.permissions, permission)) && (!input.types?.length || provider.entityTypes.some((type) => input.types?.includes(type))));
  const settled = await Promise.allSettled(selected.map((provider) => withTimeout(provider.search({ user, query, normalizedQuery: normalizeSearchText(query), limit: perProviderLimit }))));
  const unavailableTypes: SearchEntityType[] = [];
  const merged: SearchResult[] = [];
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") merged.push(...entry.value.filter((item) => !input.types?.length || input.types.includes(item.entityType)));
    else unavailableTypes.push(...selected[index].entityTypes.filter((type) => !input.types?.length || input.types.includes(type)));
  });
  const ranked = rankSearchResults(query, merged, recentKeys);
  const offset = Math.max(input.offset ?? 0, 0);
  const results = ranked.slice(offset, offset + perProviderLimit);
  const totals: GlobalSearchResponse["totals"] = {};
  for (const item of ranked) totals[item.entityType] = (totals[item.entityType] ?? 0) + 1;
  return { results, nextCursor: offset + perProviderLimit < ranked.length ? String(offset + perProviderLimit) : undefined, unavailableTypes: [...new Set(unavailableTypes)], totals };
}
