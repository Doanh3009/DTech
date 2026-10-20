import "server-only";

import { AppError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { normalizeEmployeeRoleIds } from "@/services/authorization/employeeAccessPolicy";

export async function normalizeEmployeeAccountRoles(roleIds: readonly string[]): Promise<string[]> {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Cơ sở dữ liệu chưa được cấu hình.");
  const { data, error } = await client.from("roles").select("id,code");
  if (error || !data?.some((role) => role.code === "employee")) {
    throw new AppError("SERVER_ERROR", "Không tìm thấy vai trò Nhân viên.");
  }
  return normalizeEmployeeRoleIds(roleIds, data.map((role) => ({ id: String(role.id), code: String(role.code) })));
}
