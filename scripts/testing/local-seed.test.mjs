// @vitest-environment node
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";
import { createLocalSeed } from "./local-seed.mjs";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), cp: vi.fn(),
  spawn: vi.fn(), spawnSync: vi.fn()
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, writeFile: mocks.writeFile, mkdir: mocks.mkdir, cp: mocks.cp }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn, spawnSync: mocks.spawnSync }));
const { readFile } = await vi.importActual("node:fs/promises");
const seed = await readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/202610020001_standardize_employee_access_and_timesheet_exports.sql", import.meta.url), "utf8");
const accountIds = [
  "a0000000-0000-4000-8000-000000000001",
  "91000000-0000-4000-8000-000000000001",
  "91000000-0000-4000-8000-000000000002"
];
const periodIds = [1, 2, 3, 4].map((number) => `98300000-0000-4000-8000-${String(number).padStart(12, "0")}`);

describe("disposable local seed SQL", () => {
  it("checks ownership immediately after BEGIN and preserves the original seed body", () => {
    const sql = createLocalSeed(seed, migration);
    const originalBody = seed.slice(seed.indexOf("begin;") + "begin;".length).replace(/\bcommit;\s*$/i, "");
    expect(sql).toContain(`begin;\n\n-- Local test bootstrap ownership preflight\nlock table public.app_accounts`);
    expect(sql).toContain(`end $local_test_preflight$;\n${originalBody}`);
    expect(sql.indexOf("LOCAL_TEST_DEMO_ACCOUNT_CONFLICT")).toBeLessThan(sql.indexOf("insert into public.employees"));
    expect(sql.indexOf("LOCAL_TEST_DEMO_ACCOUNT_CONFLICT")).toBeLessThan(sql.indexOf("metadata=excluded.metadata"));
    expect(sql).toMatch(/commit;\n$/);
  });

  it("checks all three stable identity mappings and allows missing seed accounts before insertion", () => {
    const sql = createLocalSeed(seed, migration);
    const preflight = sql.slice(sql.indexOf("do $local_test_preflight$"), sql.indexOf("end $local_test_preflight$;"));
    const expectations = [
      [accountIds[0], "user_a0000000", "admin@chautuan.local", "40000000-0000-4000-8000-000000000004", "hr002"],
      [accountIds[1], "test.supervisor", "supervisor.test@chautuan.local", "90000000-0000-4000-8000-000000000001", "test-gs01"],
      [accountIds[2], "test.employee", "employee.test@chautuan.local", "90000000-0000-4000-8000-000000000002", "test-nv01"]
    ];
    for (const [id, username, email, employeeId, employeeCode] of expectations) {
      expect(preflight).toContain(`('${id}'::uuid, '${username}', '${email}', '${employeeId}'::uuid, '${employeeCode}')`);
    }
    expect(preflight).toContain("account.username is distinct from expected.username");
    expect(preflight).toContain("lower(account.primary_email) is distinct from expected.email");
    expect(preflight).toContain("account.employee_id is distinct from expected.employee_id");
    expect(preflight).toContain(`if not exists (select 1 from public.app_accounts where id = '${accountIds[0]}'::uuid)`);
    expect(preflight.match(/if not exists/g)).toHaveLength(1);
  });

  it("rejects username, email and employee collisions under a different account ID", () => {
    const sql = createLocalSeed(seed, migration);
    expect(sql).toContain(`or (account.id <> expected.id and (
        lower(account.username) = expected.username
        or lower(account.primary_email) = expected.email
        or account.employee_id = expected.employee_id
      ))`);
    expect(sql).toContain("lower(employee.employee_code) is distinct from expected.employee_code");
    expect(sql).toContain("lower(employee.company_email) is distinct from expected.email");
    expect(sql).toContain("employee.id <> expected.employee_id and lower(employee.employee_code) = expected.employee_code");
  });

  it("rejects malformed metadata and a foreign or explicitly null owner before seed overwrites it", () => {
    const sql = createLocalSeed(seed, migration);
    expect(sql).toContain("jsonb_typeof(account.metadata) is distinct from 'object'");
    expect(sql).toContain(`account.metadata ? 'testOwner' and account.metadata->>'testOwner' is distinct from '${TEST_OWNER}'`);
    expect(sql.indexOf("account.metadata ? 'testOwner'")).toBeLessThan(sql.indexOf("metadata=excluded.metadata"));
  });

  it("tags exactly the verified built-in IDs after seed and leaves unrelated accounts untouched", () => {
    const sql = createLocalSeed(seed, migration);
    const tags = sql.match(/update public\.app_accounts\nset metadata = [\s\S]*?;/g);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain(`'{"testData":true,"testOwner":"${TEST_OWNER}"}'::jsonb`);
    expect(tags[0]).toContain(`where id in (${accountIds.map((id) => `'${id}'::uuid`).join(", ")});`);
    expect(sql.indexOf(tags[0])).toBeGreaterThan(sql.indexOf("metadata=excluded.metadata"));
    expect(tags[0]).not.toContain("username =");
    expect(tags[0]).not.toContain("auth_user_id");
  });

  it("requires all three seeded accounts and employee links and rechecks ownership before tagging", () => {
    const sql = createLocalSeed(seed, migration);
    const start = sql.indexOf("do $local_test_postseed$");
    const end = sql.indexOf("end $local_test_postseed$;");
    const validation = sql.slice(start, end);
    expect(start).toBeGreaterThan(sql.indexOf("metadata=excluded.metadata"));
    expect(end).toBeLessThan(sql.indexOf("update public.app_accounts\nset metadata"));
    expect(validation).toContain("for expected in");
    expect(validation).toContain("account.username is distinct from expected.username");
    expect(validation).toContain(`account.metadata ? 'testOwner' and account.metadata->>'testOwner' is distinct from '${TEST_OWNER}'`);
    expect(validation).toContain("join public.employees employee on employee.id = account.employee_id");
    expect(validation).toContain("LOCAL_TEST_SEEDED_DEMO_ACCOUNT_MISSING");
  });

  it("reuses snapshot construction for only four seed periods and preserves existing immutable versions", () => {
    const sql = createLocalSeed(seed, migration);
    const repair = sql.slice(sql.indexOf("insert into public.timesheet_period_versions"));
    const originalRepair = migration.slice(migration.indexOf("insert into public.timesheet_period_versions")).trim();
    const scoped = `where period.id in (${periodIds.map((id) => `'${id}'::uuid`).join(", ")})\n  and period.status = 'locked'`;
    expect(repair).toBe(`${originalRepair.replace("where period.status = 'locked'", scoped)}\n\ncommit;\n`);
    expect(repair).toContain("and period.version > 0");
    expect(repair).toContain("and not exists (");
    expect(repair).toContain("on conflict (period_id, version) do nothing;");
    expect(sql).not.toContain("delete from public.account_roles");
    expect(repair).not.toMatch(/\b(update|delete)\b/i);
  });

  it.each([
    seed.replace("begin;", ""),
    seed.replace(/commit;\s*$/, ""),
    `insert into unrelated values(1);\n${seed}`,
    `${seed}\nselect 1;`
  ])("rejects a seed without an enclosing transaction before generating output", (invalidSeed) => {
    expect(() => createLocalSeed(invalidSeed, migration)).toThrow("transaction BEGIN/COMMIT");
  });

  it("rejects a generated local copy rather than inserting a second preflight", () => {
    expect(() => createLocalSeed(createLocalSeed(seed, migration), migration)).toThrow("đã được gắn ownership");
  });

  it.each([
    migration.replace("-- Repair legacy or seeded locked periods", "-- Missing repair"),
    `${migration}\n-- Repair legacy or seeded locked periods duplicate`,
    migration.replace("where period.status = 'locked'", "where period.status = 'open'"),
    migration.replace("on conflict (period_id, version) do nothing;", "on conflict (period_id, version) do update set snapshot=excluded.snapshot;"),
    `${migration}\ndelete from public.app_accounts;`,
    migration.replace("from public.timesheet_periods period", "from public.timesheet_periods period; delete from public.app_accounts;")
  ])("rejects an unrecognized snapshot repair instead of copying broad writes", (invalidMigration) => {
    expect(() => createLocalSeed(seed, invalidMigration)).toThrow();
  });

  it.each([[null, migration], [seed, undefined]])("requires SQL strings", (invalidSeed, invalidMigration) => {
    expect(() => createLocalSeed(invalidSeed, invalidMigration)).toThrow("SQL seed và migration snapshot");
  });
});

describe("local runner isolation without Docker", () => {
  const originalArgv = [...process.argv];
  const taskRoot = path.resolve("test-results/local-supabase");
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.argv = [originalArgv[0], "scripts/testing/local.mjs", "start"];
    mocks.readFile.mockImplementation(async (filename) => {
      if (filename === "supabase/config.toml") return 'project_id = "CT_NoiBo"\n[api]\nport = 54321\n[db]\nport = 54322\nshadow_port = 54320\n';
      if (filename === "supabase/seed.sql") return seed;
      if (filename === "supabase/migrations/202610020001_standardize_employee_access_and_timesheet_exports.sql") return migration;
      throw new Error(`Unexpected read: ${filename}`);
    });
    mocks.spawnSync.mockReturnValue({ status: 0 });
    const child = { on: vi.fn() };
    child.on.mockReturnValue(child);
    mocks.spawn.mockReturnValue(child);
  });
  afterEach(() => { process.argv = [...originalArgv]; });

  it("writes the transformed seed and fixed project/ports only under the disposable workdir", async () => {
    await import("./local.mjs");
    expect(mocks.mkdir).toHaveBeenCalledWith(path.join(taskRoot, "supabase"), { recursive: true });
    expect(mocks.cp).toHaveBeenCalledExactlyOnceWith("supabase/migrations", path.join(taskRoot, "supabase/migrations"), { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith(path.join(taskRoot, "supabase/seed.sql"), createLocalSeed(seed, migration));
    expect(mocks.writeFile).toHaveBeenCalledWith(path.join(taskRoot, "supabase/config.toml"), 'project_id = "CT_NoiBo_Test"\n[api]\nport = 55321\n[db]\nport = 55322\nshadow_port = 55320\n');
    for (const [target] of mocks.writeFile.mock.calls) expect(target.startsWith(`${taskRoot}${path.sep}`)).toBe(true);
    expect(mocks.spawn).toHaveBeenCalledWith(process.execPath, ["node_modules/supabase/dist/supabase.js", "start", "--workdir", taskRoot], { stdio: "inherit", shell: false, windowsHide: true });
  });

  it.each([undefined, "--confirm-local=CT_NoiBo", "--confirm-local=another-project"])("rejects a reset without the exact local confirmation before any side effect", async (confirmation) => {
    process.argv[2] = "reset";
    if (confirmation) process.argv.push(confirmation);
    await expect(import("./local.mjs")).rejects.toThrow("--confirm-local=CT_NoiBo_Test");
    expect(mocks.spawnSync).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("runs a confirmed reset with --local and the fixed disposable workdir", async () => {
    process.argv.push("--confirm-local=CT_NoiBo_Test");
    process.argv[2] = "reset";
    await import("./local.mjs");
    expect(mocks.spawn).toHaveBeenCalledWith(process.execPath, ["node_modules/supabase/dist/supabase.js", "db", "reset", "--local", "--workdir", taskRoot], { stdio: "inherit", shell: false, windowsHide: true });
  });

  it("refuses an unavailable Docker server before writing local files", async () => {
    mocks.spawnSync.mockReturnValue({ status: 1 });
    await expect(import("./local.mjs")).rejects.toThrow("Docker Desktop");
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("refuses unsupported commands before any side effect", async () => {
    process.argv[2] = "remote";
    await expect(import("./local.mjs")).rejects.toThrow();
    expect(mocks.spawnSync).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
