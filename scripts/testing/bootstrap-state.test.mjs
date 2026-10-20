// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { inspectBootstrapState, readBootstrapRecords } from "./bootstrap-state.mjs";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";

const projectId = "abcdefghijklmnopqrst";
const owner = { key: "owner", value: { owner: TEST_OWNER, projectId } };
const guardedState = [{ guard: "supabase_migrations.ct_test_bootstrap", public_relations: 180 }];

function queryWith(...results) {
  return vi.fn(async (sql, readOnly) => {
    expect(readOnly).toBe(true);
    expect(sql.trim()).toMatch(/^select\b/i);
    expect(results.length).toBeGreaterThan(0);
    return results.shift();
  });
}

describe("remote bootstrap state before writes", () => {
  it("allows an unguarded database only when public contains no user relations", async () => {
    const query = queryWith([{ guard: null, public_relations: 0 }]);
    const result = await inspectBootstrapState(query, projectId);
    expect(result.hasGuard).toBe(false);
    expect(result.recorded.size).toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("namespace.nspname = 'public'");
  });

  it.each(["r", "p", "v", "m", "f"])("rejects an unguarded database containing a public relation of kind %s", async (kind) => {
    const query = queryWith([{ guard: null, public_relations: 1 }]);
    await expect(inspectBootstrapState(query, projectId)).rejects.toThrow("Database có bảng hoặc view public nhưng chưa có bootstrap guard");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain(`'${kind}'`);
  });

  it("reads a matching existing owner and preserves migration and seed checksums without setup writes", async () => {
    const migration = { key: "202609090001_foundation_system_primitives.sql", value: { sha256: "migration-checksum" } };
    const seed = { key: "seed.sql", value: { sha256: "seed-checksum" } };
    const query = queryWith(guardedState, [owner, migration, seed]);
    const result = await inspectBootstrapState(query, projectId);
    expect(result.hasGuard).toBe(true);
    expect(result.recorded.get("owner")).toEqual(owner.value);
    expect(result.recorded.get(migration.key)).toEqual(migration.value);
    expect(result.recorded.get(seed.key)).toEqual(seed.value);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([
    { records: [{ key: "owner", value: { owner: "foreign-owner", projectId } }] },
    { records: [{ key: "owner", value: { owner: TEST_OWNER, projectId: "another-project" } }] },
    { records: [] }
  ])("rejects foreign or missing ownership before allowing any write", async ({ records }) => {
    const query = queryWith(guardedState, records);
    await expect(inspectBootstrapState(query, projectId)).rejects.toThrow("Bootstrap guard không khớp target");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    [],
    [{ public_relations: 0 }],
    [{ guard: null, public_relations: "0" }],
    [{ guard: null, public_relations: -1 }],
    [{ guard: null, public_relations: null }],
    [{ guard: "", public_relations: 0 }]
  ].map((initial) => ({ initial })))("rejects an unverified database state", async ({ initial }) => {
    const query = queryWith(initial);
    await expect(inspectBootstrapState(query, projectId)).rejects.toThrow("Không xác minh được trạng thái database trước bootstrap");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("verifies the owner after new guard setup using only a read query", async () => {
    const query = queryWith([owner]);
    await expect(readBootstrapRecords(query, projectId)).resolves.toEqual(new Map([["owner", owner.value]]));
  });

  it("rejects malformed guard records rather than treating them as an initialized database", async () => {
    const query = queryWith(guardedState, [{ key: "owner", value: null }]);
    await expect(inspectBootstrapState(query, projectId)).rejects.toThrow("Không đọc được bootstrap guard hợp lệ");
  });
});
