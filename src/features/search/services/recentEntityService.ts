import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { RecentEntity, SearchEntityType } from "@/features/search/types";
import { resolvePlatformIdentity } from "@/features/shared-platforms/services/platformIdentity";
import { getDocument } from "@/features/shared-platforms/services/documentRepository";

const permissionByType: Record<SearchEntityType, Parameters<typeof can>[1]> = {
  employee: "employee.view",
  project: "project.view",
  worksite: "worksite.view",
  warehouse_item: "warehouse.item.view",
  warehouse_document: "warehouse.view",
  shipment: "shipment.view",
  import_contract: "import_contract.view",
  leave_request: "leave.view",
  timesheet_period: "timesheet.view",
  document: "document.view"
};

async function projectIdsForUser(client: SupabaseClient, user: AuthenticatedUser, employeeId?: string): Promise<string[] | undefined> {
  if (can(user.permissions, "project_monitoring.view_all") || can(user.permissions, "project_update.view_all")) return undefined;
  if (!employeeId) return [];
  const { data } = await client.from("project_assignments").select("project_id").eq("employee_id", employeeId).eq("status", "active");
  return [...new Set((data ?? []).map((row) => String(row.project_id)))];
}

async function warehouseIdsForUser(client: SupabaseClient, user: AuthenticatedUser, accountId: string): Promise<string[] | undefined> {
  if (can(user.permissions, "warehouse.view_all")) return undefined;
  const { data } = await client.from("warehouse_user_scopes").select("warehouse_id").eq("account_id", accountId).eq("can_view", true);
  return (data ?? []).map((row) => String(row.warehouse_id));
}

async function isRecentEntityAccessible(client: SupabaseClient, user: AuthenticatedUser, actor: { accountId: string; employeeId?: string }, item: RecentEntity): Promise<boolean> {
  const id = item.entityId;
  if (item.entityType === "document") {
    try { const document = await getDocument(user, id); return document.status !== "deleted_pending_retention"; } catch { return false; }
  }
  if (item.entityType === "employee") return Boolean((await client.from("employees").select("id").eq("id", id).maybeSingle()).data);
  if (item.entityType === "project" || item.entityType === "worksite") {
    const projectIds = await projectIdsForUser(client, user, actor.employeeId);
    if (item.entityType === "project") {
      let query = client.from("projects").select("id").eq("id", id);
      if (projectIds) { if (!projectIds.length) return false; query = query.in("id", projectIds); }
      return Boolean((await query.maybeSingle()).data);
    }
    let query = client.from("worksites").select("id").eq("id", id);
    if (projectIds) { if (!projectIds.length) return false; query = query.in("project_id", projectIds); }
    return Boolean((await query.maybeSingle()).data);
  }
  if (item.entityType === "warehouse_item") return Boolean((await client.from("inventory_items").select("id").eq("id", id).eq("status", "active").maybeSingle()).data);
  if (item.entityType === "warehouse_document") {
    const warehouseIds = await warehouseIdsForUser(client, user, actor.accountId);
    const { data } = await client.from("inventory_documents").select("id,source_warehouse_id,target_warehouse_id").eq("id", id).maybeSingle();
    if (!data) return false;
    return !warehouseIds || warehouseIds.includes(String(data.source_warehouse_id)) || warehouseIds.includes(String(data.target_warehouse_id));
  }
  if (item.entityType === "shipment") {
    let query = client.from("shipments").select("id").eq("id", id);
    if (!can(user.permissions, "import_export.view_all")) query = query.or(`assigned_account_id.eq.${actor.accountId},created_by.eq.${actor.accountId}`);
    return Boolean((await query.maybeSingle()).data);
  }
  if (item.entityType === "import_contract") return Boolean((await client.from("import_contracts").select("id").eq("id", id).maybeSingle()).data);
  if (item.entityType === "leave_request") {
    let query = client.from("leave_requests").select("id").eq("id", id);
    if (!can(user.permissions, "leave.view_all") && !can(user.permissions, "leave.approve_all")) {
      if (!actor.employeeId) return false;
      query = query.eq("employee_id", actor.employeeId);
    }
    return Boolean((await query.maybeSingle()).data);
  }
  if (item.entityType === "timesheet_period") return Boolean((await client.from("timesheet_periods").select("id").eq("id", id).maybeSingle()).data);
  return false;
}

export async function listRecentEntities(user: AuthenticatedUser, limit = 8): Promise<RecentEntity[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];
  const actor = await resolvePlatformIdentity(client, user);
  const { data, error } = await client.from("recent_entity_access").select("entity_type,entity_id,title,subtitle,deep_link,last_accessed_at").eq("user_id", actor.accountId).order("last_accessed_at", { ascending: false }).limit(Math.min(limit * 3, 60));
  if (error) return [];
  const candidates = (data ?? []).flatMap((row) => {
    const entityType = row.entity_type as SearchEntityType;
    if (!permissionByType[entityType] || !can(user.permissions, permissionByType[entityType])) return [];
    return [{ entityType, entityId: String(row.entity_id), title: String(row.title), subtitle: row.subtitle ? String(row.subtitle) : undefined, deepLink: String(row.deep_link), lastAccessedAt: String(row.last_accessed_at) }];
  });
  const checked = await Promise.all(candidates.map(async (item) => ({ item, allowed: await isRecentEntityAccessible(client, user, actor, item) })));
  return checked.filter((entry) => entry.allowed).map((entry) => entry.item).slice(0, limit);
}

export async function recordRecentEntity(user: AuthenticatedUser, entity: Omit<RecentEntity, "lastAccessedAt">): Promise<void> {
  if (!can(user.permissions, permissionByType[entity.entityType])) throw new AppError("PERMISSION_DENIED");
  const client = getSupabaseServiceClient();
  if (!client) return;
  const actor = await resolvePlatformIdentity(client, user);
  const { error } = await client.from("recent_entity_access").upsert({
    user_id: actor.accountId,
    entity_type: entity.entityType,
    entity_id: entity.entityId,
    title: entity.title.slice(0, 240),
    subtitle: entity.subtitle?.slice(0, 300) ?? null,
    deep_link: entity.deepLink.slice(0, 500),
    last_accessed_at: new Date().toISOString()
  }, { onConflict: "user_id,entity_type,entity_id" });
  if (error) throw new AppError("SERVER_ERROR", "Không thể cập nhật mục gần đây.");
}
