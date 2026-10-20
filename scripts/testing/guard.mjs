import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertTestEnvironment, TEST_OWNER } from "../../src/lib/testing/policy.mjs";
export const MARKER_KEY = "testing.environment.guard";
export async function assertSeedTarget(env = process.env) {
  assert(!process.argv.includes("--reset"), "Reset cũ không bảo toàn chứng từ/audit; dùng test:reset hoặc test:local:reset với xác nhận mục tiêu");
  const target = assertTestEnvironment(env);
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  assert(key, "Thiếu service key của database test");
  const db = createClient(target.databaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("app_configurations").select("value").eq("key", MARKER_KEY).maybeSingle();
  assert(!error && data?.value?.owner === TEST_OWNER && data.value.target === target.databaseUrl && data.value.projectId === target.projectId, "Database chưa được xác nhận là môi trường test bằng test:environment:init");
  return { db, target };
}
