import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { assignmentInputSchema, projectInputSchema, projectProgressInputSchema, worksiteInputSchema } from "@/features/projects/schemas/projectSchemas";
import type { DailySchedule, EmployeeProjectAssignment, ProjectAssignment, ProjectDetail, ProjectProgressNode, ProjectSummary, Worksite } from "@/features/projects/types/projectTypes";
import { recordAuditLog } from "@/services/audit/auditLog";
import { getApprovedLeaveForEmployeesDate } from "@/features/leave/services/leaveRepository";

type Row = Record<string, unknown>;

function db(): SupabaseClient {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return client;
}

function required(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) throw new AppError("SERVER_ERROR", "Dữ liệu thiếu " + key + ".");
  return value;
}

function optional(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value ? value : undefined;
}

function nested(row: Row, key: string): Row | undefined {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as Row | undefined;
  return value && typeof value === "object" ? value as Row : undefined;
}

function mapWorksite(row: Row): Worksite {
  return {
    id: required(row, "id"), projectId: required(row, "project_id"), name: required(row, "name"),
    address: optional(row, "address"), latitude: row.latitude == null ? undefined : Number(row.latitude), longitude: row.longitude == null ? undefined : Number(row.longitude), updatedAt: optional(row, "updated_at"), radiusMeters: Number(row.radius_meters), gpsRequired: Boolean(row.gps_required),
    allowedAccuracyThresholdMeters: Number(row.allowed_accuracy_threshold_meters),
    status: required(row, "status") as Worksite["status"], activeFrom: optional(row, "active_from"), activeTo: optional(row, "active_to")
  };
}

function mapAssignment(row: Row): ProjectAssignment {
  const employee = nested(row, "employees");
  const worksite = nested(row, "worksites");
  return {
    id: required(row, "id"), projectId: required(row, "project_id"), worksiteId: optional(row, "worksite_id"),
    worksiteName: worksite ? optional(worksite, "name") : undefined, employeeId: required(row, "employee_id"),
    employeeCode: employee ? required(employee, "employee_code") : "—", employeeName: employee ? required(employee, "full_name") : "—",
    assignmentRole: required(row, "assignment_role") as ProjectAssignment["assignmentRole"], startDate: required(row, "start_date"),
    endDate: optional(row, "end_date"), shiftCode: required(row, "shift_code"), shiftName: required(row, "shift_name"),
    shiftStart: required(row, "shift_start").slice(0, 5), shiftEnd: required(row, "shift_end").slice(0, 5),
    status: required(row, "status") as ProjectAssignment["status"], rowVersion: Number(row.row_version)
  };
}

function mapProgressNode(row: Row): ProjectProgressNode {
  const assignee = nested(row, "employees");
  return { id: required(row, "id"), projectId: required(row, "project_id"), parentId: optional(row, "parent_id"), nodeType: required(row, "node_type") as ProjectProgressNode["nodeType"], name: required(row, "name"), status: required(row, "status") as ProjectProgressNode["status"], completionPercent: Number(row.completion_percent), deadline: optional(row, "deadline"), assigneeEmployeeId: optional(row, "assignee_employee_id"), assigneeName: assignee ? optional(assignee, "full_name") : undefined, sortOrder: Number(row.sort_order), rowVersion: Number(row.row_version) };
}

const projectSelect = "*,manager:employees!projects_project_manager_employee_id_fkey(full_name)";
const assignmentSelect = "*,employees!project_assignments_employee_id_fkey(employee_code,full_name,employment_status),worksites(name)";

async function actorAccountId(client: SupabaseClient, user: AuthenticatedUser): Promise<string | undefined> {
  let query = client.from("app_accounts").select("id").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể xác định tài khoản dự án.");
  return data?.id ? String(data.id) : undefined;
}

function hasCompanyProjectScope(user: AuthenticatedUser): boolean {
  return can(user.permissions, "project_monitoring.view_all") || can(user.permissions, "worker_attendance.view_all");
}

async function scopedProjectIds(client: SupabaseClient, user: AuthenticatedUser): Promise<Set<string> | undefined> {
  if (hasCompanyProjectScope(user)) return undefined;
  let accountQuery = client.from("app_accounts").select("id,employee_id").limit(1);
  accountQuery = /^[0-9a-f-]{36}$/i.test(user.id) ? accountQuery.eq("id", user.id) : accountQuery.eq("primary_email", user.email);
  const { data: account, error: accountError } = await accountQuery.maybeSingle();
  if (accountError) throw new AppError("SERVER_ERROR", "Không thể xác định tài khoản dự án.");
  const accountId = account?.id ? String(account.id) : undefined;
  let employeeId = account?.employee_id ? String(account.employee_id) : undefined;
  // Preserve the existing email fallback for an unresolved account identifier.
  // The normal authenticated path reads account and employee IDs together.
  if (!accountId) {
    const { data: fallback, error: fallbackError } = await client.from("app_accounts")
      .select("employee_id").eq("primary_email", user.email).limit(1).maybeSingle();
    if (fallbackError) throw new AppError("SERVER_ERROR", "Không thể xác định phạm vi dự án.");
    employeeId = fallback?.employee_id ? String(fallback.employee_id) : undefined;
  }
  const [assignedResult, managedResult, createdResult] = await Promise.all([
    employeeId
      ? client.from("project_assignments").select("project_id").eq("employee_id", employeeId).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    employeeId
      ? client.from("projects").select("id").eq("project_manager_employee_id", employeeId)
      : Promise.resolve({ data: [], error: null }),
    accountId
      ? client.from("projects").select("id").eq("created_by", accountId)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (assignedResult.error || managedResult.error || createdResult.error) throw new AppError("SERVER_ERROR", "Không thể xác định phạm vi dự án.");
  return new Set([
    ...(assignedResult.data ?? []).map((row) => String(row.project_id)),
    ...(managedResult.data ?? []).map((row) => String(row.id)),
    ...(createdResult.data ?? []).map((row) => String(row.id))
  ]);
}

async function assertProjectScope(client: SupabaseClient, user: AuthenticatedUser, projectId: string): Promise<void> {
  const scope = await scopedProjectIds(client, user);
  if (scope && !scope.has(projectId)) throw new AppError("NOT_FOUND", "Không tìm thấy dự án.");
}

export async function listProjects(user?: AuthenticatedUser): Promise<ProjectSummary[]> {
  const client = db();
  const [projectResult, worksiteResult, assignmentResult, scope] = await Promise.all([
    (async () => {
      const selected = await client.from("projects").select(projectSelect).order("updated_at", { ascending: false });
      return selected.error ? client.from("projects").select("*").order("updated_at", { ascending: false }) : selected;
    })(),
    client.from("worksites").select("project_id,id"),
    client.from("project_assignments").select("project_id,employee_id").eq("status", "active"),
    user ? scopedProjectIds(client, user) : Promise.resolve(undefined)
  ]);
  if (projectResult.error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách dự án.");
  const data = projectResult.data;
  const worksites = worksiteResult.error ? [] : worksiteResult.data;
  const assignments = assignmentResult.error ? [] : assignmentResult.data;
  return (data ?? []).filter((item) => !scope || scope.has(String(item.id))).map((item) => {
    const row = item as Row;
    const manager = nested(row, "manager");
    return {
      id: required(row, "id"), code: required(row, "code"), name: required(row, "name"), customerName: optional(row, "customer_name"), summary: optional(row, "summary"),
      startDate: required(row, "start_date"), expectedEndDate: optional(row, "expected_end_date"), actualEndDate: optional(row, "actual_end_date"),
      status: required(row, "status") as ProjectSummary["status"], health: (optional(row, "health") ?? "on_track") as ProjectSummary["health"], projectManagerEmployeeId: optional(row, "project_manager_employee_id"),
      projectManagerName: manager ? optional(manager, "full_name") : undefined,
      currentPeople: new Set((assignments ?? []).filter((assignment) => assignment.project_id === row.id).map((assignment) => assignment.employee_id)).size,
      worksiteCount: (worksites ?? []).filter((worksite) => worksite.project_id === row.id).length,
      rowVersion: Number(row.row_version)
    };
  });
}

export async function listEmployeeProjects(user: AuthenticatedUser, employeeId: string): Promise<EmployeeProjectAssignment[]> {
  if (!can(user.permissions, "project.view")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const projects = await listProjects(user);
  if (!projects.length) return [];

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const { data, error } = await client
    .from("project_assignments")
    .select("id,project_id,assignment_role,start_date,end_date,status,worksites(name)")
    .eq("employee_id", employeeId)
    .in("project_id", projects.map((project) => project.id))
    .order("start_date", { ascending: false });
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc dự án của nhân viên.");

  return (data ?? []).flatMap((value): EmployeeProjectAssignment[] => {
    const row = value as Row;
    const project = projectById.get(required(row, "project_id"));
    if (!project) return [];
    const worksite = nested(row, "worksites");
    return [{
      project,
      assignmentId: required(row, "id"),
      assignmentRole: required(row, "assignment_role") as EmployeeProjectAssignment["assignmentRole"],
      worksiteName: worksite ? optional(worksite, "name") : undefined,
      startDate: required(row, "start_date"),
      endDate: optional(row, "end_date"),
      status: required(row, "status") as EmployeeProjectAssignment["status"]
    }];
  });
}

export async function getProject(projectId: string, user?: AuthenticatedUser): Promise<ProjectDetail> {
  const client = db();
  if (user) await assertProjectScope(client, user, projectId);
  const [{ data, error }, { data: sites, error: siteError }, { data: assignments, error: assignmentError }] = await Promise.all([
    client.from("projects").select(projectSelect).eq("id", projectId).maybeSingle(),
    client.from("worksites").select("*").eq("project_id", projectId).order("name"),
    client.from("project_assignments").select(assignmentSelect).eq("project_id", projectId).order("assignment_role")
  ]);
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy dự án.");
  if (siteError || assignmentError) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu dự án.");
  const summary = (await listProjects(user)).find((project) => project.id === projectId);
  if (!summary) throw new AppError("NOT_FOUND", "Không tìm thấy dự án.");
  return { ...summary, note: optional(data as Row, "note"), worksites: (sites ?? []).map((row) => mapWorksite(row as Row)), assignments: (assignments ?? []).map((row) => mapAssignment(row as Row)) };
}

export async function listProjectProgress(user: AuthenticatedUser, projectId: string): Promise<ProjectProgressNode[]> {
  if (!can(user.permissions, "project.view")) throw new AppError("PERMISSION_DENIED");
  await getProject(projectId, user);
  const { data, error } = await db().from("project_progress_nodes").select("*,employees(full_name)").eq("project_id", projectId).order("sort_order").order("created_at");
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc cây tiến độ.");
  return (data ?? []).map((row) => mapProgressNode(row as Row));
}

async function refreshProgressParents(client: SupabaseClient, projectId: string, parentId?: string | null): Promise<void> {
  let current = parentId ?? undefined;
  for (let depth = 0; current && depth < 12; depth += 1) {
    const [{ data: children }, { data: node }] = await Promise.all([client.from("project_progress_nodes").select("completion_percent,status").eq("project_id", projectId).eq("parent_id", current), client.from("project_progress_nodes").select("parent_id").eq("id", current).maybeSingle()]);
    if (children?.length) {
      const completion = Math.round(children.reduce((sum, child) => sum + Number(child.completion_percent), 0) / children.length);
      const status = children.every((child) => child.status === "completed") ? "completed" : children.some((child) => child.status === "blocked") ? "blocked" : completion > 0 ? "in_progress" : "not_started";
      await client.from("project_progress_nodes").update({ completion_percent: completion, status, updated_at: new Date().toISOString() }).eq("id", current);
    }
    current = node?.parent_id ? String(node.parent_id) : undefined;
  }
}

export async function saveProjectProgress(user: AuthenticatedUser, projectId: string, input: z.infer<typeof projectProgressInputSchema>): Promise<ProjectProgressNode[]> {
  if (!can(user.permissions, "project.edit") && !can(user.permissions, "project.manage_schedule")) throw new AppError("PERMISSION_DENIED");
  const client = db(); await getProject(projectId, user); const actor = await actorAccountId(client, user);
  if (input.parentId) { const { data: parent } = await client.from("project_progress_nodes").select("id").eq("id", input.parentId).eq("project_id", projectId).maybeSingle(); if (!parent) throw new AppError("VALIDATION_ERROR", "Hạng mục cha không thuộc dự án."); }
  const values = { parent_id: input.parentId ?? null, node_type: input.nodeType, name: input.name, status: input.status, completion_percent: input.completionPercent, deadline: input.deadline ?? null, assignee_employee_id: input.assigneeEmployeeId ?? null, sort_order: input.sortOrder, updated_at: new Date().toISOString() };
  if (input.id) {
    if (input.parentId === input.id) throw new AppError("VALIDATION_ERROR", "Hạng mục không thể là cấp cha của chính nó.");
    let ancestorId = input.parentId;
    for (let depth = 0; ancestorId && depth < 24; depth += 1) {
      if (ancestorId === input.id) throw new AppError("VALIDATION_ERROR", "Cấu trúc cấp cha tạo thành vòng lặp.");
      const { data: ancestor } = await client.from("project_progress_nodes").select("parent_id").eq("id", ancestorId).eq("project_id", projectId).maybeSingle();
      ancestorId = ancestor?.parent_id ? String(ancestor.parent_id) : undefined;
    }
    const { data: before } = await client.from("project_progress_nodes").select("*").eq("id", input.id).eq("project_id", projectId).maybeSingle();
    if (!before) throw new AppError("NOT_FOUND", "Không tìm thấy hạng mục.");
    const { data, error } = await client.from("project_progress_nodes").update({ ...values, row_version: input.rowVersion! + 1 }).eq("id", input.id).eq("row_version", input.rowVersion!).select("id").maybeSingle();
    if (error || !data) throw new AppError("CONFLICT", "Hạng mục vừa được cập nhật. Vui lòng tải lại.");
    await refreshProgressParents(client, projectId, before.parent_id ? String(before.parent_id) : undefined); await refreshProgressParents(client, projectId, input.parentId);
    await recordAuditLog({ actorId: actor ?? user.id, action: "project.progress.updated", entityType: "project_progress_node", entityId: input.id, before, after: values });
  } else {
    const { data, error } = await client.from("project_progress_nodes").insert({ project_id: projectId, ...values, created_by: actor }).select("id").single();
    if (error || !data) throw new AppError("SERVER_ERROR", "Không thể tạo hạng mục tiến độ.");
    await refreshProgressParents(client, projectId, input.parentId); await recordAuditLog({ actorId: actor ?? user.id, action: "project.progress.created", entityType: "project_progress_node", entityId: String(data.id), after: values });
  }
  return listProjectProgress(user, projectId);
}

export async function createProject(user: AuthenticatedUser, input: z.infer<typeof projectInputSchema>): Promise<ProjectDetail> {
  if (!can(user.permissions, "project.create")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const accountId = await actorAccountId(client, user);
  const { data, error } = await client.from("projects").insert({
    code: input.code, name: input.name, customer_name: input.customerName || null, summary: input.summary || null,
    start_date: input.startDate, expected_end_date: input.expectedEndDate || null, status: input.status,
    project_manager_employee_id: input.projectManagerEmployeeId || null, note: input.note || null, created_by: accountId
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new AppError("CONFLICT", "Mã dự án đã tồn tại.");
    throw new AppError("SERVER_ERROR", "Không thể tạo dự án.");
  }
  await recordAuditLog({ actorId: accountId ?? user.id, action: "project.created", entityType: "project", entityId: data.id, after: { code: input.code, status: input.status } });
  return getProject(data.id, user);
}

export async function createWorksite(user: AuthenticatedUser, projectId: string, input: z.infer<typeof worksiteInputSchema>): Promise<Worksite> {
  if (!can(user.permissions, "worksite.manage")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const project = await getProject(projectId, user);
  if (project.status === "closed") throw new AppError("CONFLICT", "Dự án đã đóng, không thể thêm công trường.");
  const accountId = await actorAccountId(client, user);
  const { data, error } = await client.from("worksites").insert({
    project_id: projectId, name: input.name, address: input.address || null, latitude: input.latitude ?? null, longitude: input.longitude ?? null,
    radius_meters: input.radiusMeters, gps_required: input.gpsRequired, allowed_accuracy_threshold_meters: input.allowedAccuracyThresholdMeters,
    active_from: input.activeFrom || null, active_to: input.activeTo || null, created_by: accountId
  }).select("*").single();
  if (error || !data) throw new AppError(error?.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error?.code === "23505" ? "Địa điểm này đã tồn tại trong dự án." : "Không thể tạo công trường.");
  await recordAuditLog({ actorId: accountId ?? user.id, action: "worksite.created", entityType: "worksite", entityId: data.id, metadata: { projectId } });
  return mapWorksite(data as Row);
}

function rangesOverlap(firstStart: string, firstEnd: string | undefined, secondStart: string, secondEnd: string | undefined) {
  return firstStart <= (secondEnd ?? "9999-12-31") && secondStart <= (firstEnd ?? "9999-12-31");
}

function timesOverlap(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export async function createAssignment(user: AuthenticatedUser, projectId: string, input: z.infer<typeof assignmentInputSchema>): Promise<ProjectAssignment> {
  if (!can(user.permissions, "project.manage_team")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const project = await getProject(projectId, user);
  if (project.status === "closed") throw new AppError("CONFLICT", "Dự án đã đóng, không thể phân công mới.");
  if (input.worksiteId && !project.worksites.some((site) => site.id === input.worksiteId && site.status === "active")) throw new AppError("VALIDATION_ERROR", "Công trường không hoạt động hoặc không thuộc dự án.");
  const { data: current } = await client.from("project_assignments").select("*").eq("employee_id", input.employeeId).eq("status", "active");
  const conflict = (current ?? []).find((row) => rangesOverlap(input.startDate, input.endDate, row.start_date, row.end_date ?? undefined) && timesOverlap(input.shiftStart, input.shiftEnd, String(row.shift_start).slice(0, 5), String(row.shift_end).slice(0, 5)) && row.worksite_id !== (input.worksiteId ?? null));
  if (conflict) throw new AppError("CONFLICT", "Nhân sự này đã có phân công trùng thời gian tại công trường khác.");
  const accountId = await actorAccountId(client, user);
  const { data, error } = await client.from("project_assignments").insert({
    project_id: projectId, worksite_id: input.worksiteId || null, employee_id: input.employeeId, assignment_role: input.assignmentRole,
    start_date: input.startDate, end_date: input.endDate || null, shift_code: input.shiftCode, shift_name: input.shiftName,
    shift_start: input.shiftStart, shift_end: input.shiftEnd, note: input.note || null, assigned_by: accountId
  }).select(assignmentSelect).single();
  if (error || !data) throw new AppError(error?.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error?.code === "23505" ? "Phân công này đã tồn tại." : "Không thể phân công nhân sự.");
  await recordAuditLog({ actorId: accountId ?? user.id, action: "project.assignment_created", entityType: "project_assignment", entityId: data.id, metadata: { projectId, employeeId: input.employeeId } });
  return mapAssignment(data as Row);
}

export async function getProjectRoster(projectId: string, date: string, worksiteId?: string, user?: AuthenticatedUser): Promise<ProjectAssignment[]> {
  const client = db();
  if (user) await assertProjectScope(client, user, projectId);
  let query = client.from("project_assignments").select(assignmentSelect).eq("project_id", projectId).eq("status", "active").lte("start_date", date).or("end_date.is.null,end_date.gte." + date);
  if (worksiteId) query = query.eq("worksite_id", worksiteId);
  const { data, error } = await query;
  if (error) throw new AppError("SERVER_ERROR", "Không thể tạo roster theo ngày.");
  const roster=(data ?? []).map((row) => mapAssignment(row as Row));
  const leaveByEmployee=await getApprovedLeaveForEmployeesDate(roster.map(item=>item.employeeId),date);
  return roster.map(item=>({...item,approvedLeave:leaveByEmployee.get(item.employeeId)}));
}

export async function getProjectSchedule(projectId: string, from: string, to: string, user?: AuthenticatedUser): Promise<DailySchedule[]> {
  const project = await getProject(projectId, user);
  const result: DailySchedule[] = [];
  const cursor = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  while (cursor <= end && result.length < 62 * Math.max(1, project.worksites.length)) {
    const date = cursor.toISOString().slice(0, 10);
    for (const site of project.worksites.filter((item) => item.status === "active")) {
      const roster = await getProjectRoster(projectId, date, site.id);
      result.push({ date, worksiteId: site.id, worksiteName: site.name, supervisorNames: roster.filter((item) => item.assignmentRole.startsWith("supervisor")).map((item) => item.employeeName), peopleCount: roster.length, workerCount: roster.filter((item) => item.assignmentRole === "worker").length });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export async function updateWorksite(user: AuthenticatedUser, projectId: string, worksiteId: string, input: z.infer<typeof worksiteInputSchema> & { updatedAt: string; status: Worksite["status"] }): Promise<Worksite> {
  if (!can(user.permissions, "worksite.manage")) throw new AppError("PERMISSION_DENIED");
  const project = await getProject(projectId, user);
  if (!project.worksites.some(site => site.id === worksiteId)) throw new AppError("NOT_FOUND", "Công trường không thuộc dự án này.");
  const client = db(), accountId = await actorAccountId(client, user);
  const { data, error } = await client.from("worksites").update({ name: input.name, address: input.address || null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, radius_meters: input.radiusMeters, gps_required: input.gpsRequired, allowed_accuracy_threshold_meters: input.allowedAccuracyThresholdMeters, active_from: input.activeFrom || null, active_to: input.activeTo || null, status: input.status, updated_at: new Date().toISOString() }).eq("id", worksiteId).eq("project_id", projectId).eq("updated_at", input.updatedAt).select("*").maybeSingle();
  if (error || !data) throw new AppError("CONFLICT", error?.code === "23505" ? "Tên công trường đã tồn tại." : "Công trường vừa được cập nhật. Tải lại trước khi lưu.");
  await recordAuditLog({ actorId: accountId ?? user.id, action: "worksite.updated", entityType: "worksite", entityId: worksiteId, metadata: { projectId, status: input.status } });
  return mapWorksite(data as Row);
}
