import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

export interface PlatformIdentity { accountId: string; employeeId?: string; displayName: string; }

export async function resolvePlatformIdentity(client: SupabaseClient, user: AuthenticatedUser): Promise<PlatformIdentity> {
  let query = client.from("app_accounts").select("id,employee_id,display_name,status").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email);
  const { data, error } = await query.maybeSingle();
  if (error || !data || data.status !== "active") throw new AppError("PERMISSION_DENIED", "Tài khoản chưa sẵn sàng.");
  return { accountId: String(data.id), employeeId: data.employee_id ?? undefined, displayName: data.display_name ?? user.displayName };
}
