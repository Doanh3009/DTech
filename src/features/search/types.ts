import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";

export const searchEntityTypes = [
  "employee",
  "project",
  "worksite",
  "warehouse_item",
  "warehouse_document",
  "shipment",
  "import_contract",
  "leave_request",
  "timesheet_period",
  "document"
] as const;

export type SearchEntityType = (typeof searchEntityTypes)[number];

export interface SearchResult {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  reference?: string;
  status?: string;
  icon: string;
  deepLink: string;
  score: number;
}

export interface SearchProviderContext {
  user: AuthenticatedUser;
  query: string;
  normalizedQuery: string;
  limit: number;
}

export interface SearchProvider {
  key: string;
  entityTypes: SearchEntityType[];
  requiredAny: Permission[];
  search(context: SearchProviderContext): Promise<SearchResult[]>;
}

export interface GlobalSearchResponse {
  results: SearchResult[];
  nextCursor?: string;
  unavailableTypes: SearchEntityType[];
  totals: Partial<Record<SearchEntityType, number>>;
}

export interface RecentEntity {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  deepLink: string;
  lastAccessedAt: string;
}
