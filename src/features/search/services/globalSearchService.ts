import "server-only";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { globalSearchCore } from "@/features/search/services/globalSearchCore";
import { listRecentEntities } from "@/features/search/services/recentEntityService";
import { searchProviders } from "@/features/search/services/providers";
import type { GlobalSearchResponse, SearchEntityType } from "@/features/search/types";

export async function globalSearch(user: AuthenticatedUser, input: { query: string; types?: SearchEntityType[]; limit?: number; offset?: number }): Promise<GlobalSearchResponse> {
  const recent = await listRecentEntities(user, 20);
  return globalSearchCore(user, input, searchProviders, new Set(recent.map((item) => `${item.entityType}:${item.entityId}`)));
}
