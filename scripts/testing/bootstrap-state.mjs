import assert from "node:assert/strict";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";

const initialStateQuery = `select
  to_regclass('supabase_migrations.ct_test_bootstrap')::text as guard,
  (select count(*)::integer
   from pg_catalog.pg_class relation
   join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public'
     and relation.relkind in ('r', 'p', 'v', 'm', 'f')) as public_relations`;

export async function readBootstrapRecords(query, projectId) {
  const rows = await query("select key,value from supabase_migrations.ct_test_bootstrap", true);
  assert(Array.isArray(rows) && rows.every((row) => row && typeof row.key === "string" && row.value && typeof row.value === "object" && !Array.isArray(row.value)), "Không đọc được bootstrap guard hợp lệ");
  const recorded = new Map(rows.map((row) => [row.key, row.value]));
  assert(recorded.get("owner")?.owner === TEST_OWNER && recorded.get("owner")?.projectId === projectId, "Bootstrap guard không khớp target");
  return recorded;
}

export async function inspectBootstrapState(query, projectId) {
  const rows = await query(initialStateQuery, true);
  assert(Array.isArray(rows) && rows.length === 1, "Không xác minh được trạng thái database trước bootstrap");
  const state = rows[0];
  assert(state && Object.hasOwn(state, "guard") && (state.guard === null || typeof state.guard === "string" && state.guard.length > 0) && Number.isSafeInteger(state.public_relations) && state.public_relations >= 0, "Không xác minh được trạng thái database trước bootstrap");
  if (state.guard !== null) {
    // Validate the existing owner before the caller may issue any write.
    return { hasGuard: true, recorded: await readBootstrapRecords(query, projectId) };
  }
  assert(state.public_relations === 0, "Database có bảng hoặc view public nhưng chưa có bootstrap guard; dừng");
  return { hasGuard: false, recorded: new Map() };
}
