import "server-only";
import { cookies } from "next/headers";
import { AppError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import accounts from "@/config/testAccounts.json";
import { TEST_GATE_COOKIE, TEST_OWNER, testToolsAvailable, validTesterToken } from "@/lib/testing/policy.mjs";

export function requireTestEnvironment() {
  const environment = testToolsAvailable();
  if (!environment) throw new AppError("NOT_FOUND");
  return environment;
}
// Shell visibility is a hint, not authorization. The account and database
// ownership checks run at every testing API before returning data or logging in.
export async function getTestControlsEnvironment(username: string): Promise<string | undefined> {
  const environment = testToolsAvailable();
  if (!environment || !accounts.some((account) => account.username === username)) return undefined;
  const token = (await cookies()).get(TEST_GATE_COOKIE)?.value;
  return token && validTesterToken(token) ? environment.environment : undefined;
}
export async function requireTester() {
  const environment = requireTestEnvironment();
  const token = (await cookies()).get(TEST_GATE_COOKIE)?.value;
  if (!token || !validTesterToken(token)) throw new AppError("AUTHENTICATION_REQUIRED");
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR");
  const { data, error } = await client.from("app_configurations").select("value").eq("key", "testing.environment.guard").abortSignal(AbortSignal.timeout(8_000)).maybeSingle();
  if (error) throw new AppError("NETWORK_ERROR", "Không thể xác nhận môi trường kiểm thử. Vui lòng thử lại.");
  if (data?.value?.owner !== TEST_OWNER || data.value.target !== environment.databaseUrl || data.value.projectId !== environment.projectId) throw new AppError("PERMISSION_DENIED");
  return environment;
}
export async function listTestAccounts() {
  const environment = await requireTester();
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR");
  const { data, error } = await client.from("app_accounts").select("id,username,status,employee_id,auth_user_id,metadata").in("username", accounts.map((item) => item.username)).abortSignal(AbortSignal.timeout(8_000));
  if (error) throw new AppError("SERVER_ERROR");
  return accounts.flatMap((profile) => {
    const row = data?.find((item) => item.username === profile.username && item.metadata?.testOwner === TEST_OWNER && item.metadata?.testTarget === environment.databaseUrl);
    return row?.auth_user_id && row.employee_id ? [{ username: profile.username, label: profile.label, status: row.status }] : [];
  });
}
export async function assertManagedTestAccount(username: string) {
  const environment = await requireTester();
  if (!accounts.some((item) => item.username === username)) throw new AppError("PERMISSION_DENIED");
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR");
  const { data, error } = await client.from("app_accounts").select("id,username,status,metadata,auth_user_id,employee_id").eq("username", username).abortSignal(AbortSignal.timeout(8_000)).maybeSingle();
  if (error || !data || data.metadata?.testOwner !== TEST_OWNER || data.metadata?.testTarget !== environment.databaseUrl || !data.auth_user_id || !data.employee_id) throw new AppError("PERMISSION_DENIED");
  if (data.status !== "active") throw new AppError("ACCOUNT_DISABLED");
  return data;
}
