import "server-only";

import type { z } from "zod";

import { departmentInputSchema, positionInputSchema } from "@/features/employees/schemas/employeeSchemas";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser, type Permission } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";

type Row = Record<string, unknown>;
type DepartmentInput = z.infer<typeof departmentInputSchema>;
type PositionInput = z.infer<typeof positionInputSchema>;

function db() {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return client;
}

function requireCatalogView(user: AuthenticatedUser) {
  if (!(["employee.view", "department.manage", "position.manage"] as Permission[]).some((permission) => can(user.permissions, permission))) {
    throw new AppError("PERMISSION_DENIED");
  }
}

function nested(value: unknown): Row | undefined {
  if (Array.isArray(value)) return value[0] as Row | undefined;
  return value && typeof value === "object" ? value as Row : undefined;
}

function optional(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function mapDepartment(row: Row, headcount = 0) {
  const manager = nested(row.manager);
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    parentDepartmentId: optional(row.parent_department_id),
    managerEmployeeId: optional(row.manager_employee_id),
    managerName: manager?.full_name ? String(manager.full_name) : undefined,
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
    headcount
  };
}

function mapPosition(row: Row, headcount = 0) {
  const department = nested(row.departments);
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    departmentId: optional(row.department_id),
    departmentName: department?.name ? String(department.name) : undefined,
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
    headcount
  };
}

export async function getOrganizationCatalog(user: AuthenticatedUser) {
  requireCatalogView(user);
  const client = db();
  const [departments, positions, employees] = await Promise.all([
    client.from("departments").select("*,manager:employees!departments_manager_employee_fk(full_name)").order("sort_order").order("name"),
    client.from("positions").select("*,departments(name)").order("sort_order").order("name"),
    client.from("employees").select("id,employee_code,full_name,department_id,position_id,employment_status").neq("employment_status", "terminated").order("full_name")
  ]);
  const failure = [departments, positions, employees].find((result) => result.error);
  if (failure?.error) throw new AppError("SERVER_ERROR", "Không thể đọc cơ cấu nhân sự.");

  const departmentCounts = new Map<string, number>();
  const positionCounts = new Map<string, number>();
  for (const employee of employees.data ?? []) {
    departmentCounts.set(String(employee.department_id), (departmentCounts.get(String(employee.department_id)) ?? 0) + 1);
    positionCounts.set(String(employee.position_id), (positionCounts.get(String(employee.position_id)) ?? 0) + 1);
  }

  return {
    departments: (departments.data ?? []).map((row) => mapDepartment(row as Row, departmentCounts.get(String(row.id)) ?? 0)),
    positions: (positions.data ?? []).map((row) => mapPosition(row as Row, positionCounts.get(String(row.id)) ?? 0)),
    employees: (employees.data ?? []).map((row) => ({ id: String(row.id), code: String(row.employee_code), name: String(row.full_name) }))
  };
}

async function assertDepartmentParent(id: string, parentDepartmentId?: string) {
  if (!parentDepartmentId) return;
  if (id === parentDepartmentId) throw new AppError("VALIDATION_ERROR", "Phòng ban không thể trực thuộc chính nó.");
  const { data, error } = await db().from("departments").select("id,parent_department_id");
  if (error) throw new AppError("SERVER_ERROR", "Không thể kiểm tra cơ cấu phòng ban.");
  const parents = new Map((data ?? []).map((row) => [String(row.id), optional(row.parent_department_id)]));
  if (!parents.has(parentDepartmentId)) throw new AppError("VALIDATION_ERROR", "Phòng ban cấp trên không tồn tại.");
  let current: string | undefined = parentDepartmentId;
  const visited = new Set<string>();
  while (current) {
    if (current === id || visited.has(current)) throw new AppError("VALIDATION_ERROR", "Cơ cấu phòng ban tạo thành vòng lặp.");
    visited.add(current);
    current = parents.get(current);
  }
}

export async function createDepartment(user: AuthenticatedUser, input: DepartmentInput) {
  if (!can(user.permissions, "department.manage")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const { data, error } = await client.from("departments").insert({
    code: input.code.toUpperCase(), name: input.name, parent_department_id: input.parentDepartmentId ?? null,
    manager_employee_id: input.managerEmployeeId ?? null, active: input.active, sort_order: input.sortOrder
  }).select("id").single();
  if (error || !data) throw new AppError(error?.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error?.code === "23505" ? "Mã phòng ban đã tồn tại." : "Không thể tạo phòng ban.");
  await recordAuditLog({ actorId: user.id, action: "organization.department.created", entityType: "department", entityId: String(data.id), after: input });
  return getOrganizationCatalog(user);
}

export async function updateDepartment(user: AuthenticatedUser, id: string, input: DepartmentInput) {
  if (!can(user.permissions, "department.manage")) throw new AppError("PERMISSION_DENIED");
  await assertDepartmentParent(id, input.parentDepartmentId);
  const client = db();
  const { data: before } = await client.from("departments").select("*").eq("id", id).maybeSingle();
  if (!before) throw new AppError("NOT_FOUND", "Không tìm thấy phòng ban.");
  const { error } = await client.from("departments").update({
    code: input.code.toUpperCase(), name: input.name, parent_department_id: input.parentDepartmentId ?? null,
    manager_employee_id: input.managerEmployeeId ?? null, active: input.active, sort_order: input.sortOrder
  }).eq("id", id);
  if (error) throw new AppError(error.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error.code === "23505" ? "Mã phòng ban đã tồn tại." : "Không thể cập nhật phòng ban.");
  await recordAuditLog({ actorId: user.id, action: "organization.department.updated", entityType: "department", entityId: id, before, after: input });
  return getOrganizationCatalog(user);
}

export async function createPosition(user: AuthenticatedUser, input: PositionInput) {
  if (!can(user.permissions, "position.manage")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const { data, error } = await client.from("positions").insert({
    code: input.code.toUpperCase(), name: input.name, department_id: input.departmentId ?? null,
    active: input.active, sort_order: input.sortOrder
  }).select("id").single();
  if (error || !data) throw new AppError(error?.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error?.code === "23505" ? "Mã chức vụ đã tồn tại." : "Không thể tạo chức vụ.");
  await recordAuditLog({ actorId: user.id, action: "organization.position.created", entityType: "position", entityId: String(data.id), after: input });
  return getOrganizationCatalog(user);
}

export async function updatePosition(user: AuthenticatedUser, id: string, input: PositionInput) {
  if (!can(user.permissions, "position.manage")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const { data: before } = await client.from("positions").select("*").eq("id", id).maybeSingle();
  if (!before) throw new AppError("NOT_FOUND", "Không tìm thấy chức vụ.");
  const { error } = await client.from("positions").update({
    code: input.code.toUpperCase(), name: input.name, department_id: input.departmentId ?? null,
    active: input.active, sort_order: input.sortOrder
  }).eq("id", id);
  if (error) throw new AppError(error.code === "23505" ? "CONFLICT" : "SERVER_ERROR", error.code === "23505" ? "Mã chức vụ đã tồn tại." : "Không thể cập nhật chức vụ.");
  await recordAuditLog({ actorId: user.id, action: "organization.position.updated", entityType: "position", entityId: id, before, after: input });
  return getOrganizationCatalog(user);
}

export async function listAllEmployeeContracts(user: AuthenticatedUser) {
  if (!can(user.permissions, "contract.view")) throw new AppError("PERMISSION_DENIED");
  const client=db();
  const { data, error } = await client.from("employee_contracts")
    .select("*,employees!employee_contracts_employee_id_fkey(employee_code,full_name,departments!employees_department_id_fkey(name),positions(name))")
    .order("effective_date", { ascending: false, nullsFirst: false });
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách hợp đồng.");
  const canViewFile = can(user.permissions, "contract.file.view");
  const fileIds=(data??[]).map(row=>optional(row.attachment_file_id)).filter((value):value is string=>Boolean(value));
  const{data:assets,error:assetError}=canViewFile&&fileIds.length?await client.from("file_assets").select("id,mime_type,metadata").in("id",fileIds):{data:[],error:null};
  if(assetError)throw new AppError("SERVER_ERROR","Không thể đọc file hợp đồng.");
  const assetById=new Map((assets??[]).map(asset=>[String(asset.id),asset]));
  return (data ?? []).map((row) => {
    const employee = nested(row.employees) ?? {};
    const department = nested(employee.departments);
    const position = nested(employee.positions);
    const attachmentFileId=canViewFile?optional(row.attachment_file_id):undefined;
    const asset=attachmentFileId?assetById.get(attachmentFileId):undefined;
    return {
      id: String(row.id), employeeId: String(row.employee_id), employeeCode: String(employee.employee_code ?? ""), employeeName: String(employee.full_name ?? ""),
      departmentName: optional(department?.name), positionName: optional(position?.name), contractNumber: String(row.contract_number), contractType: String(row.contract_type),
      signedDate: optional(row.signed_date), effectiveDate: optional(row.effective_date) ?? String(row.start_date), endDate: optional(row.end_date), status: String(row.status),
      archivedAt: optional(row.archived_at), attachmentFileId,
      attachmentFileName:typeof asset?.metadata?.originalName==="string"?asset.metadata.originalName:undefined,
      attachmentMimeType:asset?.mime_type?String(asset.mime_type):undefined
    };
  });
}
