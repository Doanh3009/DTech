// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { defaultSystemSettings } from "../../src/config/systemSettings";
import { moduleKeys, settingsPreview, validateDeploymentManifest, workspace } from "./deployment-manifest.mjs";
import {
  ACTIVATION_GROUPS, activationArguments, activationFingerprint, activationGroupsParser, assertActivationCommandReady,
  activationPlanFile, createActivationPlan, executeActivationPlan, localActivationPreview,
  readActivationSettings, runActivation, validateReviewedActivationPlan
} from "./activation.mjs";

const source = JSON.parse(await readFile(new URL("../../supabase/deployments/customer.example.json", import.meta.url), "utf8"));
const manifest = { ...validateDeploymentManifest(source), manifestFile: "supabase/deployments/customer.example.json" };
const actorId = "a3d4a550-aecb-4a5f-861f-f944cde74f8c";
const requestId = "e6da6c42-6202-471f-ad13-f696597bdc1d";
const environmentFile = ".env.customer.local";
const credentials = { NEXT_PUBLIC_SUPABASE_URL: manifest.target.apiUrl, SUPABASE_SECRET_KEY: "synthetic-key-not-real" };
const common = [`--manifest=${manifest.manifestFile}`, `--environment-file=${environmentFile}`, `--project-ref=${manifest.target.projectRef}`];
let parseGroups;
beforeAll(async () => { parseGroups = await activationGroupsParser(); });

function storedRows() {
  return ACTIVATION_GROUPS.map((group, index) => ({ group_key: group, version: index + 2, value: structuredClone(defaultSystemSettings[group]) }));
}
function prepared(changes = {}) {
  return createActivationPlan(manifest, { rows: storedRows(), actorId, requestId, environmentFile, parseGroups, now: "2026-10-21T03:00:00.000Z", ...changes });
}
function reviewed(input = prepared().plan, changes = {}) {
  return validateReviewedActivationPlan(input, manifest, {
    confirmPlan: activationFingerprint(input), projectRef: manifest.target.projectRef, environmentFile, parseGroups, ...changes
  });
}
function remote(data = storedRows()) {
  const query = { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data, error: null }), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
  const client = { from: vi.fn().mockReturnValue(query), rpc: vi.fn() };
  return { query, client };
}
function runtime(client, extra = {}) {
  return {
    loadManifest: vi.fn().mockResolvedValue(manifest), parseGroups,
    environment: vi.fn().mockResolvedValue(credentials), createClient: vi.fn().mockReturnValue(client),
    readPlan: vi.fn().mockResolvedValue(prepared().plan), writePlan: vi.fn().mockResolvedValue(".tmp/reviewed-activation.json"), ...extra
  };
}

describe("activation command options and local preview", () => {
  it("defaults to a pure manifest preview without opening environment files or clients", async () => {
    const dependencies = { loadManifest: vi.fn().mockResolvedValue(manifest), environment: vi.fn(), createClient: vi.fn(), writePlan: vi.fn() };
    const preview = await runActivation([], dependencies);
    expect(preview).toMatchObject({ dryRun: true, networkAccess: false, appliesChanges: false, patches: settingsPreview(manifest.target) });
    expect(dependencies.environment).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
    expect(dependencies.writePlan).not.toHaveBeenCalled();
  });

  it("does not include passwords, admin bootstrap or environment values in local preview", () => {
    const preview = localActivationPreview(manifest);
    expect(preview).not.toHaveProperty("admin");
    expect(preview).not.toHaveProperty("environmentFile");
    expect(JSON.stringify(preview)).not.toContain("SUPABASE_SECRET_KEY");
  });

  it.each([
    ["--unknown"], ["--apply", "--prepare"], ["--apply"], ["--prepare"], ["--output=.tmp/plan.json"],
    ["--actor-id=wrong"], ["--project-ref=aaaaaaaaaaaaaaaaaaaa"], ["--plan=.tmp/plan.json"],
    [...common, "--prepare", `--actor-id=${actorId}`],
    [...common, "--prepare", "--actor-id=wrong", "--output=.tmp/plan.json"],
    [...common, "--prepare", `--actor-id=${actorId}`, "--output=.tmp/plan.json", "--request-id=wrong"],
    [...common, "--prepare", `--actor-id=${actorId}`, "--output=.tmp/plan.json", "--plan=.tmp/other.json"],
    [...common, "--apply", "--plan=.tmp/plan.json", "--confirm-plan=wrong"],
    [...common, "--apply", "--plan=.tmp/plan.json", `--confirm-plan=${"a".repeat(64)}`, `--actor-id=${actorId}`],
    [...common, "--apply", "--plan=.tmp/plan.json", `--confirm-plan=${"a".repeat(64)}`, `--request-id=${requestId}`],
    ["--prepare", "--manifest=supabase/deployments/customer.example.json", "--environment-file=.env.local", `--project-ref=${manifest.target.projectRef}`, `--actor-id=${actorId}`, "--output=.tmp/plan.json"]
  ])("rejects unsupported or incomplete options %j", (argv) => {
    expect(() => activationArguments(argv)).toThrow();
  });

  it.each(["plan.json", "supabase/deployments/plan.json", "../plan.json", ".tmp/../plan.json", ".tmp/plan.txt"])("keeps reviewed configuration in ignored .tmp JSON files: %s", (filename) => {
    expect(() => activationPlanFile(filename)).toThrow();
  });

  it("accepts a local ignored review file", () => {
    expect(activationPlanFile(".tmp/customer/activation.json")).toBe(path.join(workspace, ".tmp", "customer", "activation.json"));
  });
});

describe("prepared snapshots", () => {
  it("merges only manifest-owned fields and preserves stored customer customization", () => {
    const rows = storedRows();
    rows.find((row) => row.group_key === "branding").value.loginSubtitle = "Cổng nhân viên";
    rows.find((row) => row.group_key === "branding").value.logoMainUrl = "/brand/custom.png";
    rows.find((row) => row.group_key === "organization").value.address = "Địa chỉ doanh nghiệp đã xác nhận";
    rows.find((row) => row.group_key === "localization").value.dateFormat = "YYYY-MM-DD";
    const before = structuredClone(rows);
    const { plan } = prepared({ rows });
    expect(plan.groups.branding).toMatchObject({ systemName: manifest.target.customer.systemName, loginSubtitle: "Cổng nhân viên", logoMainUrl: "/brand/custom.png" });
    expect(plan.groups.organization.address).toBe("Địa chỉ doanh nghiệp đã xác nhận");
    expect(plan.groups.localization.dateFormat).toBe("YYYY-MM-DD");
    expect(plan.groups.modules.projects).toBe(false);
    expect(plan.groups.modules.warehouse).toBe(true);
    expect(plan.requestId).toBe(requestId);
    expect(plan.expectedVersions).toEqual({ branding: 2, organization: 3, localization: 4, modules: 5 });
    expect(rows).toEqual(before);
  });

  it("assigns one UUID when preparing and persists it in the plan", () => {
    const { plan } = prepared({ requestId: undefined });
    expect(plan.requestId).toMatch(/^[a-f\d-]{36}$/);
    expect(reviewed(plan).requestId).toBe(plan.requestId);
  });

  it.each([
    ["missing group", (rows) => rows.pop()],
    ["duplicate group", (rows) => { rows[3] = rows[0]; }],
    ["unknown group", (rows) => { rows[0].group_key = "new_group"; }],
    ["invalid stored field", (rows) => { rows[0].value.assetVersion = "bad"; }],
    ["unknown stored field", (rows) => { rows[1].value.unreviewed = true; }],
    ["missing required flag", (rows) => { delete rows[3].value.human_resources; }],
    ["null group", (rows) => { rows[1].value = null; }]
  ])("refuses %s instead of filling customer configuration from defaults", (_, mutate) => {
    const rows = storedRows(); mutate(rows);
    expect(() => prepared({ rows })).toThrow();
  });

  it.each([0, -1, 1.5, "2", null, 2_147_483_647])("refuses invalid current version %s", (version) => {
    const rows = storedRows(); rows[0].version = version;
    expect(() => prepared({ rows })).toThrow(/Phiên bản/);
  });

  it("preserves legacy optional-flag semantics without resetting explicit disabled flags", () => {
    const rows = storedRows();
    delete rows[3].value.accounting;
    delete rows[3].value.operations;
    rows[3].value.messaging = false;
    delete rows[3].value.industryPreset;
    const legacyRows = structuredClone(rows);
    const { plan } = prepared({ rows });
    expect(plan.groups.modules).toEqual(settingsPreview(manifest.target).modules);
    expect(rows).toEqual(legacyRows);
  });

  it("checks the same field schema as the application plus explicit activation capability flags", () => {
    const { plan } = prepared();
    expect(parseGroups(plan.groups)).toEqual(plan.groups);
    expect(Object.keys(plan.groups.modules).filter((key) => key !== "industryPreset")).toEqual(expect.arrayContaining(moduleKeys));
    for (const key of moduleKeys) expect(typeof plan.groups.modules[key]).toBe("boolean");
  });

  it("fingerprints configuration deterministically independent of object key order", () => {
    const { plan, sha256 } = prepared();
    expect(activationFingerprint(Object.fromEntries(Object.entries(plan).reverse()))).toBe(sha256);
    expect(activationFingerprint({ ...plan, actorId: randomUUID() })).not.toBe(sha256);
  });
});

describe("reviewed plan validation", () => {
  it("accepts the exact reviewed target/configuration", () => {
    const { plan } = prepared();
    expect(reviewed(plan)).toEqual(plan);
  });

  it("rejects changed bytes when the approved hash remains unchanged", () => {
    const { plan, sha256 } = prepared();
    plan.groups.organization.address = "Changed after review";
    expect(() => reviewed(plan, { confirmPlan: sha256 })).toThrow(/SHA-256/);
  });

  it.each([
    ["project", (plan) => { plan.projectRef = "aaaaaaaaaaaaaaaaaaaa"; }],
    ["URL", (plan) => { plan.apiUrl = "https://aaaaaaaaaaaaaaaaaaaa.supabase.co"; }],
    ["deployment", (plan) => { plan.deploymentId = "another-customer"; }],
    ["manifest path", (plan) => { plan.manifestFile = "supabase/deployments/other.json"; }],
    ["manifest fingerprint", (plan) => { plan.manifestSha256 = "a".repeat(64); }],
    ["environment", (plan) => { plan.environmentFile = ".env.other.local"; }],
    ["command", (plan) => { plan.command = "unexpected_command"; }],
    ["schema version", (plan) => { plan.schemaVersion = 2; }],
    ["command version", (plan) => { plan.commandVersion = 2; }],
    ["unexpected plan field", (plan) => { plan.password = "synthetic-secret-never-log"; }],
    ["unknown snapshot field", (plan) => { plan.groups.branding.secret = "synthetic-secret-never-log"; }],
    ["wrong module flag", (plan) => { plan.groups.modules.projects = true; }],
    ["wrong customer", (plan) => { plan.groups.organization.companyName = "Another company"; }],
    ["unknown module", (plan) => { plan.groups.modules.manufacturing = true; }]
  ])("rejects mismatched or unsupported %s even if a new file hash is supplied", (_, mutate) => {
    const { plan } = prepared(); mutate(plan);
    expect(() => reviewed(plan)).toThrow();
  });

  it("does not leak invalid stored values in errors", () => {
    const { plan } = prepared(); plan.groups.branding = "synthetic-secret-never-log";
    expect(() => reviewed(plan)).not.toThrow(/synthetic-secret-never-log/);
    expect(() => reviewed(plan)).toThrow(/schema/);
  });
});

describe("read-only prepare and one atomic apply call", () => {
  it("only reads current settings and writes the local reviewed plan during prepare", async () => {
    const { client } = remote();
    const dependencies = runtime(client);
    const result = await runActivation([...common, "--prepare", `--actor-id=${actorId}`, `--request-id=${requestId}`, "--output=.tmp/reviewed-activation.json"], dependencies);
    expect(client.from).toHaveBeenCalledWith("system_settings");
    expect(client.from).toHaveBeenCalledWith("system_settings_commands");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(dependencies.writePlan).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ prepared: true, appliesChanges: false, requestId });
    expect(JSON.stringify(result)).not.toContain("synthetic-key-not-real");
  });

  it("rejects explicit target mismatch before opening a secret file or client", async () => {
    const { client } = remote(); const dependencies = runtime(client);
    await expect(runActivation([...common.filter((arg) => !arg.startsWith("--project-ref=")), "--project-ref=aaaaaaaaaaaaaaaaaaaa", "--prepare", `--actor-id=${actorId}`, "--output=.tmp/plan.json"], dependencies)).rejects.toThrow(/Project/);
    expect(dependencies.environment).not.toHaveBeenCalled();
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it("requires a readable receipt schema during prepare and performs no mutation when missing", async () => {
    const { client, query } = remote();
    query.limit.mockResolvedValue({ data: null, error: { message: "synthetic-secret-never-log" } });
    const dependencies = runtime(client);
    await expect(runActivation([...common, "--prepare", `--actor-id=${actorId}`, "--output=.tmp/plan.json"], dependencies)).rejects.toThrow(/schema activation/);
    expect(dependencies.writePlan).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects mismatched environment target before making SDK requests", async () => {
    const { client } = remote(); const dependencies = runtime(client, { environment: vi.fn().mockResolvedValue({ ...credentials, NEXT_PUBLIC_SUPABASE_URL: "https://wrong.supabase.co" }) });
    await expect(runActivation([...common, "--prepare", `--actor-id=${actorId}`, "--output=.tmp/plan.json"], dependencies)).rejects.toThrow(/Database/);
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it("rejects plan approval failure before reading secrets", async () => {
    const { client } = remote(); const dependencies = runtime(client);
    await expect(runActivation([...common, "--apply", "--plan=.tmp/plan.json", `--confirm-plan=${"a".repeat(64)}`], dependencies)).rejects.toThrow(/SHA-256/);
    expect(dependencies.environment).not.toHaveBeenCalled();
  });

  it("applies only one atomic RPC and retains actor, expected versions and request ID", async () => {
    const { plan, sha256 } = prepared(); const { client } = remote();
    const versions = Object.fromEntries(Object.entries(plan.expectedVersions).map(([key, value]) => [key, value + 1]));
    client.rpc.mockResolvedValue({ data: { requestId, versions }, error: null });
    const dependencies = runtime(client);
    const result = await runActivation([...common, "--apply", "--plan=.tmp/plan.json", `--confirm-plan=${sha256}`], dependencies);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("publish_system_settings_command", {
      p_actor_id: actorId, p_request_id: requestId, p_groups: plan.groups,
      p_expected_versions: plan.expectedVersions, p_change_type: "publish"
    });
    expect(result).toMatchObject({ applied: true, requestId, versions });
    expect(dependencies.writePlan).not.toHaveBeenCalled();
  });

  it("sends the identical request when an uncertain result is retried with the same plan", async () => {
    const { plan } = prepared(); const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "synthetic-secret-never-log" } }) };
    await expect(executeActivationPlan(client, plan)).rejects.not.toThrow(/synthetic-secret-never-log/);
    await expect(executeActivationPlan(client, plan)).rejects.toThrow(/request ID/);
    expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
  });

  it("accepts the highest integer receipt version supported by the command", async () => {
    const rows = storedRows(); rows[0].version = 2_147_483_646;
    const { plan } = prepared({ rows });
    const versions = Object.fromEntries(Object.entries(plan.expectedVersions).map(([group, value]) => [group, value + 1]));
    const client = { rpc: vi.fn().mockResolvedValue({ data: { requestId, versions }, error: null }) };
    await expect(executeActivationPlan(client, plan)).resolves.toEqual({ requestId, versions });
  });

  it.each([
    null, { requestId: randomUUID(), versions: { branding: 3, organization: 4, localization: 5, modules: 6 } },
    { requestId, versions: { branding: 99, organization: 4, localization: 5, modules: 6 } },
    { requestId, versions: { branding: 3 } }
  ])("does not mark an unexpected command result as confirmed: %j", async (data) => {
    const { plan } = prepared(); const client = { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
    await expect(executeActivationPlan(client, plan)).rejects.toThrow();
  });

  it("redacts SDK exceptions on read and apply", async () => {
    const { client, query } = remote();
    query.in.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(readActivationSettings(client)).rejects.not.toThrow(/synthetic-secret-never-log/);
    client.rpc.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(executeActivationPlan(client, prepared().plan)).rejects.not.toThrow(/synthetic-secret-never-log/);
    query.limit.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(assertActivationCommandReady(client)).rejects.not.toThrow(/synthetic-secret-never-log/);
  });
});
