import assert from "node:assert/strict";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const demoAccounts = [
  ["a0000000-0000-4000-8000-000000000001", "user_a0000000", "admin@chautuan.local", "40000000-0000-4000-8000-000000000004", "hr002"],
  ["91000000-0000-4000-8000-000000000001", "test.supervisor", "supervisor.test@chautuan.local", "90000000-0000-4000-8000-000000000001", "test-gs01"],
  ["91000000-0000-4000-8000-000000000002", "test.employee", "employee.test@chautuan.local", "90000000-0000-4000-8000-000000000002", "test-nv01"]
];
const accountIds = demoAccounts.map(([id]) => `${quote(id)}::uuid`).join(", ");
const periodIds = [1, 2, 3, 4].map((number) => `${quote(`98300000-0000-4000-8000-${String(number).padStart(12, "0")}`)}::uuid`).join(", ");
const preflightMarker = "-- Local test bootstrap ownership preflight";

function ownershipValidation(afterSeed = false) {
  const block = afterSeed ? "local_test_postseed" : "local_test_preflight";
  const values = demoAccounts.map(([id, username, email, employeeId, employeeCode]) =>
    `(${quote(id)}::uuid, ${quote(username)}, ${quote(email)}, ${quote(employeeId)}::uuid, ${quote(employeeCode)})`
  ).join(",\n      ");
  return `${afterSeed ? "-- Validate every built-in identity before attaching local ownership." : preflightMarker}
${afterSeed ? "" : "lock table public.app_accounts in share row exclusive mode;\n"}do $${block}$
declare
  expected record;
begin
  for expected in
    select * from (values
      ${values}
    ) builtin(id, username, email, employee_id, employee_code)
  loop
    if exists (
      select 1 from public.app_accounts account
      where (account.id = expected.id and (
        account.username is distinct from expected.username
        or lower(account.primary_email) is distinct from expected.email
        or account.employee_id is distinct from expected.employee_id
        or jsonb_typeof(account.metadata) is distinct from 'object'
        or (account.metadata ? 'testOwner' and account.metadata->>'testOwner' is distinct from ${quote(TEST_OWNER)})
      )) or (account.id <> expected.id and (
        lower(account.username) = expected.username
        or lower(account.primary_email) = expected.email
        or account.employee_id = expected.employee_id
      ))
    ) then
      raise exception 'LOCAL_TEST_DEMO_ACCOUNT_CONFLICT: %', expected.id;
    end if;
    if exists (
      select 1 from public.employees employee
      where (employee.id = expected.employee_id and (
        lower(employee.employee_code) is distinct from expected.employee_code
        or lower(employee.company_email) is distinct from expected.email
      ))
        or (employee.id <> expected.employee_id and lower(employee.employee_code) = expected.employee_code)
    ) then
      raise exception 'LOCAL_TEST_DEMO_EMPLOYEE_CONFLICT: %', expected.employee_id;
    end if;${afterSeed ? `
    if not exists (
      select 1 from public.app_accounts account
      join public.employees employee on employee.id = account.employee_id
      where account.id = expected.id
    ) then
      raise exception 'LOCAL_TEST_SEEDED_DEMO_ACCOUNT_MISSING: %', expected.id;
    end if;` : ""}
  end loop;
${afterSeed ? "" : `  if not exists (select 1 from public.app_accounts where id = ${quote(demoAccounts[0][0])}::uuid) then
    raise exception 'LOCAL_TEST_MIGRATION_DEMO_ACCOUNT_MISSING';
  end if;
`}end $${block}$;
`;
}

function scopedSnapshotRepair(migration) {
  const parts = migration.split("-- Repair legacy or seeded locked periods");
  assert(parts.length === 2, "Không tìm thấy repair snapshot kỳ công mẫu duy nhất");
  const repair = parts[1].replace(/^[^\r\n]*\r?\n/, "").trim();
  assert(/^--[^\r\n]*\r?\ninsert into public\.timesheet_period_versions\s*\(/i.test(repair)
    && /on conflict \(period_id, version\) do nothing;$/i.test(repair)
    && repair.split(";").length === 2, "Repair snapshot phải là một INSERT giữ nguyên phiên bản đã khóa");
  const filter = /where period\.status = 'locked'/g;
  assert([...repair.matchAll(filter)].length === 1, "Không xác minh được phạm vi repair snapshot");
  return repair.replace(filter, `where period.id in (${periodIds})\n  and period.status = 'locked'`);
}

// Only the disposable local copy is transformed. Remote bootstrap checksums
// continue to refer to the original seed and migrations.
export function createLocalSeed(seed, snapshotMigration) {
  assert(typeof seed === "string" && typeof snapshotMigration === "string", "Cần SQL seed và migration snapshot");
  const begin = /^(?:\s*--[^\r\n]*(?:\r?\n|$))*\s*begin\s*;/i.exec(seed);
  assert(begin && /\bcommit;\s*$/i.test(seed), "Seed local cần transaction BEGIN/COMMIT đầy đủ");
  assert(!seed.includes(preflightMarker), "Seed local đã được gắn ownership");
  const repair = scopedSnapshotRepair(snapshotMigration);
  const tags = `-- Own only the three verified built-in demo identities.
update public.app_accounts
set metadata = coalesce(metadata, '{}'::jsonb) || ${quote(JSON.stringify({ testData: true, testOwner: TEST_OWNER }))}::jsonb
where id in (${accountIds});`;
  const body = seed.slice(begin[0].length).replace(/\bcommit;\s*$/i, "");
  return `${begin[0]}\n\n${ownershipValidation()}${body}\n${ownershipValidation(true)}\n${tags}\n\n-- Repair only the four local seed periods, preserving existing locked versions.\n${repair}\n\ncommit;\n`;
}
