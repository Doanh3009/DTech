import "server-only";

import { listDocuments as listCompanyDocuments } from "@/features/shared-platforms/services/documentRepository";
import { listContracts, listShipments } from "@/features/import-export/services/importExportRepository";
import { listLeaveRequests } from "@/features/leave/services/leaveRepository";
import { listPeriods } from "@/features/timesheets/services/timesheetRepository";
import { listDocuments as listWarehouseDocuments, listItems } from "@/features/warehouse/services/warehouseRepository";
import { AppError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { SearchProvider, SearchResult } from "@/features/search/types";
import { normalizeSearchText, searchScore } from "@/features/search/ranking";
import { resolvePlatformIdentity } from "@/features/shared-platforms/services/platformIdentity";

function includesQuery(query: string, ...values: Array<string | undefined>): boolean {
  const normalized = normalizeSearchText(query);
  return values.some((value) => normalizeSearchText(value ?? "").includes(normalized));
}

function safeQueryValue(query: string): string {
  return query.replace(/[,%()'":\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

function result(value: Omit<SearchResult, "score">, query: string): SearchResult {
  return { ...value, score: searchScore(query, value) };
}

export const employeeSearchProvider: SearchProvider = {
  key: "employees",
  entityTypes: ["employee"],
  requiredAny: ["employee.view"],
  async search({ user, query, limit }) {
    const client = getSupabaseServiceClient();
    if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
    const safe = safeQueryValue(query);
    const clauses = [`employee_code.ilike.%${safe}%`, `full_name.ilike.%${safe}%`, `company_email.ilike.%${safe}%`];
    if (can(user.permissions, "employee.view_sensitive")) clauses.push(`personal_phone.ilike.%${safe}%`);
    const { data, error } = await client.from("employees").select("id,employee_code,full_name,company_email,employment_status,departments!employees_department_id_fkey(name),positions(name)").or(clauses.join(",")).limit(limit);
    if (error) throw new AppError("SERVER_ERROR", "Không thể tìm nhân viên.");
    return (data ?? []).map((row) => {
      const department = (Array.isArray(row.departments) ? row.departments[0] : row.departments) as { name?: string } | null;
      const position = (Array.isArray(row.positions) ? row.positions[0] : row.positions) as { name?: string } | null;
      return result({ entityType: "employee", entityId: String(row.id), title: String(row.full_name), subtitle: [department?.name, position?.name].filter(Boolean).join(" · "), reference: String(row.employee_code), status: String(row.employment_status), icon: "user", deepLink: `/employees/${row.id}/profile` }, query);
    });
  }
};

export const projectSearchProvider: SearchProvider = {
  key: "projects",
  entityTypes: ["project", "worksite"],
  requiredAny: ["project.view", "worksite.view"],
  async search({ user, query, limit }) {
    const client = getSupabaseServiceClient();
    if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
    let scopedIds: string[] | undefined;
    if (!can(user.permissions, "project_monitoring.view_all") && !can(user.permissions, "project_update.view_all")) {
      const actor = await resolvePlatformIdentity(client, user);
      if (!actor.employeeId) return [];
      const { data } = await client.from("project_assignments").select("project_id").eq("employee_id", actor.employeeId).eq("status", "active");
      scopedIds = [...new Set((data ?? []).map((row) => String(row.project_id)))];
      if (!scopedIds.length) return [];
    }
    const safe = safeQueryValue(query);
    let projectQuery = client.from("projects").select("id,code,name,customer_name,status").or(`code.ilike.%${safe}%,name.ilike.%${safe}%,customer_name.ilike.%${safe}%`).limit(limit);
    let worksiteQuery = client.from("worksites").select("id,project_id,name,address,status,projects(code,name)").or(`name.ilike.%${safe}%,address.ilike.%${safe}%`).limit(limit);
    if (scopedIds) { projectQuery = projectQuery.in("id", scopedIds); worksiteQuery = worksiteQuery.in("project_id", scopedIds); }
    const [{ data: projects, error }, { data: worksites, error: worksiteError }] = await Promise.all([projectQuery, worksiteQuery]);
    if (error || worksiteError) throw new AppError("SERVER_ERROR", "Không thể tìm dự án.");
    const projectResults = can(user.permissions, "project.view") ? (projects ?? []).map((row) => result({ entityType: "project", entityId: String(row.id), title: String(row.name), subtitle: row.customer_name ? String(row.customer_name) : undefined, reference: String(row.code), status: String(row.status), icon: "briefcase", deepLink: `/projects/${row.id}/profile` }, query)) : [];
    const worksiteResults = can(user.permissions, "worksite.view") ? (worksites ?? []).map((row) => { const project = (Array.isArray(row.projects) ? row.projects[0] : row.projects) as { name?: string; code?: string } | null; return result({ entityType: "worksite", entityId: String(row.id), title: String(row.name), subtitle: project?.name, reference: project?.code, status: String(row.status), icon: "map-pin", deepLink: `/projects/${row.project_id}/worker-attendance` }, query); }) : [];
    return [...projectResults, ...worksiteResults].slice(0, limit);
  }
};

export const warehouseSearchProvider: SearchProvider = {
  key: "warehouse",
  entityTypes: ["warehouse_item", "warehouse_document"],
  requiredAny: ["warehouse.view", "warehouse.item.view"],
  async search({ user, query, limit }) {
    const safe = safeQueryValue(query);
    const [items, documents] = await Promise.all([
      can(user.permissions, "warehouse.item.view") ? listItems(user, { search: safe }) : Promise.resolve([]),
      can(user.permissions, "warehouse.view") ? listWarehouseDocuments(user, undefined, { search: safe, limit }) : Promise.resolve([])
    ]);
    return [
      ...items.slice(0, limit).map((item) => result({ entityType: "warehouse_item" as const, entityId: item.id, title: item.name, subtitle: item.categoryName ?? item.specification, reference: item.itemCode, status: item.status, icon: "package", deepLink: `/warehouse/items/${item.id}` }, query)),
      ...documents.slice(0, limit).map((item) => result({ entityType: "warehouse_document" as const, entityId: item.id, title: item.documentNumber, subtitle: item.sourceWarehouseName ?? item.targetWarehouseName, reference: item.documentNumber, status: item.status, icon: "file-text", deepLink: `/warehouse/${item.type === "issue" ? "issues" : item.type === "transfer" ? "transfers" : item.type === "adjustment" ? "adjustments" : "receipts"}/${item.id}` }, query))
    ].slice(0, limit);
  }
};

export const importExportSearchProvider: SearchProvider = {
  key: "import-export",
  entityTypes: ["shipment", "import_contract"],
  requiredAny: ["shipment.view", "import_contract.view"],
  async search({ user, query, limit }) {
    const [shipments, contracts] = await Promise.all([
      can(user.permissions, "shipment.view") ? listShipments(user, { limit: 100 }) : Promise.resolve([]),
      can(user.permissions, "import_contract.view") ? listContracts(user) : Promise.resolve([])
    ]);
    return [
      ...shipments.filter((item) => includesQuery(query, item.shipmentNumber, item.billOfLadingNumber, item.bookingNumber, item.supplierName, item.containers.map((container) => container.containerNumber).join(" "))).slice(0, limit).map((item) => result({ entityType: "shipment" as const, entityId: item.id, title: item.shipmentNumber, subtitle: [item.supplierName, item.billOfLadingNumber].filter(Boolean).join(" · "), reference: item.shipmentNumber, status: item.status, icon: "ship", deepLink: `/import-export/shipments/${item.id}/overview` }, query)),
      ...contracts.filter((item) => includesQuery(query, item.contractNumber, item.supplierName)).slice(0, limit).map((item) => result({ entityType: "import_contract" as const, entityId: item.id, title: item.contractNumber, subtitle: item.supplierName, reference: item.contractNumber, status: item.status, icon: "file-contract", deepLink: `/import-export/contracts/${item.id}` }, query))
    ].slice(0, limit);
  }
};

export const hrDocumentSearchProvider: SearchProvider = {
  key: "hr-documents",
  entityTypes: ["leave_request", "timesheet_period", "document"],
  requiredAny: ["leave.view", "leave.self.view", "timesheet.view", "timesheet.self.view", "document.view"],
  async search({ user, query, limit }) {
    const safe = safeQueryValue(query);
    const leaveScope = can(user.permissions, "leave.view_all") || can(user.permissions, "leave.approve_all") ? "all" as const : "self" as const;
    const [requests, periods, companyDocuments] = await Promise.all([
      can(user.permissions, "leave.view") || can(user.permissions, "leave.self.view") ? listLeaveRequests(user, leaveScope) : Promise.resolve([]),
      can(user.permissions, "timesheet.view") || can(user.permissions, "timesheet.self.view") ? listPeriods(user) : Promise.resolve([]),
      can(user.permissions, "document.view") ? listCompanyDocuments(user, { q: safe }) : Promise.resolve([])
    ]);
    return [
      ...requests.filter((item) => includesQuery(query, item.requestNumber, item.employeeName, item.leaveTypeName)).slice(0, limit).map((item) => result({ entityType: "leave_request" as const, entityId: item.id, title: item.requestNumber, subtitle: `${item.employeeName} · ${item.leaveTypeName}`, reference: item.requestNumber, status: item.status, icon: "calendar", deepLink: `/leave/requests/${item.id}` }, query)),
      ...periods.filter((item) => includesQuery(query, item.code, item.name)).slice(0, limit).map((item) => result({ entityType: "timesheet_period" as const, entityId: item.id, title: item.name, subtitle: `${item.startDate} – ${item.endDate}`, reference: item.code, status: item.status, icon: "calendar-days", deepLink: `/timesheets/periods/${item.id}` }, query)),
      ...companyDocuments.filter((item) => includesQuery(query, item.title, item.ownerReference, item.documentTypeName)).slice(0, limit).map((item) => result({ entityType: "document" as const, entityId: item.id, title: item.title, subtitle: [item.documentTypeName, item.ownerReference].filter(Boolean).join(" · "), reference: item.ownerReference, status: item.status, icon: "file", deepLink: `/documents/${item.id}` }, query))
    ].slice(0, limit);
  }
};

export const searchProviders: SearchProvider[] = [employeeSearchProvider, projectSearchProvider, warehouseSearchProvider, importExportSearchProvider, hrDocumentSearchProvider];
