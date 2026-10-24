import { applicationForPath, type ApplicationId } from "@/config/moduleRegistry";
import { searchEntityTypes, type SearchEntityType } from "@/features/search/types";

// Match the destination families emitted by the existing search providers.
const entityDestinations: Record<SearchEntityType, string> = {
  employee: "/employees",
  project: "/projects",
  worksite: "/projects",
  warehouse_item: "/warehouse/items",
  warehouse_document: "/warehouse/receipts",
  shipment: "/import-export/shipments",
  import_contract: "/import-export/contracts",
  leave_request: "/leave/requests",
  timesheet_period: "/timesheets/periods",
  document: "/documents"
};

export function searchTypesForApplication(applicationId: ApplicationId): SearchEntityType[] {
  return searchEntityTypes.filter((type) => applicationForPath(entityDestinations[type]).id === applicationId);
}

export function internalSearchPath(href: string): string | undefined {
  if (!href.startsWith("/") || href.startsWith("//")) return undefined;
  return href.split(/[?#]/)[0];
}
