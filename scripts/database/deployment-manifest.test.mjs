// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertDeploymentEnvironment, assertExplicitInstanceFiles, deploymentArguments, loadDeploymentManifest, manifestFingerprint, moduleKeys, PROTECTED_PROJECT_REFS, settingsPreview, validateDeploymentManifest, workspace, workspaceFile } from "./deployment-manifest.mjs";
import { createDeploymentPlan } from "./plan.mjs";
import { defaultSystemSettings, parseSystemSettingsGroup } from "../../src/config/systemSettings";

const fixture = JSON.parse(await readFile(new URL("../../supabase/deployments/customer.example.json", import.meta.url), "utf8"));
const clone = () => structuredClone(fixture);
const legacy = () => ({ ...Object.fromEntries(Object.entries(clone()).filter(([key]) => ["name", "projectRef", "dashboardUrl", "apiUrl", "provisioningMode", "organizationId", "region", "migrationsDirectory", "includeDevelopmentSeed", "protectedExistingProjectRefs"].includes(key))), name: "DTech_ERP", projectRef: "tcjjhxqtreemccdbvyza", dashboardUrl: "https://supabase.com/dashboard/project/tcjjhxqtreemccdbvyza", apiUrl: "https://tcjjhxqtreemccdbvyza.supabase.co" });
it("customer installations cannot enable the DTech operator CRM",()=>{const {target}=validateDeploymentManifest(clone());expect(()=>assertDeploymentEnvironment(target,{NEXT_PUBLIC_SUPABASE_URL:target.apiUrl,SUPABASE_SECRET_KEY:"synthetic-key",DTECH_CONTROL_CENTER_ENABLED:"true"})).toThrow(/DTech/);});

describe("customer deployment manifests", () => {
  it("loads the existing DTech target as a versioned manifest", async () => {
    const { target, legacy } = await loadDeploymentManifest();
    expect(legacy).toBe(false);
    expect(target.projectRef).toBe("tcjjhxqtreemccdbvyza");
    expect(target.admin.username).toBe("admin");
    expect(target.customer.systemName).toBe("DTech ERP");
  });

  it("preserves the original versionless DTech contract", () => {
    const { target, legacy: isLegacy } = validateDeploymentManifest(legacy());
    expect(isLegacy).toBe(true);
    expect(target.customer.shortName).toBe("DTECH");
    expect(target.enabledModules).toEqual(moduleKeys);
    expect(target.admin.employeeCode).toBe("SYS-DTECH-ADMIN");
  });

  it("requires version 1 instead of silently assigning DTech branding to another customer", () => {
    expect(() => validateDeploymentManifest({ ...legacy(), name: "Other customer" })).toThrow(/schemaVersion 1/);
    expect(() => validateDeploymentManifest({ ...legacy(), projectRef: fixture.projectRef })).toThrow(/schemaVersion 1/);
  });

  it.each(PROTECTED_PROJECT_REFS)("always protects %s even when the manifest deletes its guard list", (ref) => {
    const value = { ...clone(), projectRef: ref, apiUrl: `https://${ref}.supabase.co`, dashboardUrl: `https://supabase.com/dashboard/project/${ref}`, protectedExistingProjectRefs: [] };
    expect(() => validateDeploymentManifest(value)).toThrow(/bảo vệ/);
  });

  it("preserves additional customer-specific protected targets", () => {
    const value = clone();
    value.protectedExistingProjectRefs = [value.projectRef];
    expect(() => validateDeploymentManifest(value)).toThrow(/bảo vệ/);
  });

  it.each([
    ["schema version", (value) => { value.schemaVersion = 2; }],
    ["project URL", (value) => { value.apiUrl = "https://different.supabase.co"; }],
    ["dashboard URL", (value) => { value.dashboardUrl += "/wrong"; }],
    ["development seed", (value) => { value.includeDevelopmentSeed = true; }],
    ["migration override", (value) => { value.migrationsDirectory = "../other"; }],
    ["unknown module", (value) => { value.enabledModules.push("manufacturing"); }],
    ["duplicate module", (value) => { value.enabledModules.push(value.enabledModules[0]); }],
    ["unknown industry", (value) => { value.industryPreset = "unimplemented"; }],
    ["admin username", (value) => { value.admin.username = "root@example.com"; }],
    ["unsupported locale", (value) => { value.localization.locale = "en-US"; }],
    ["remote HTTP", (value) => { value.application.baseUrl = "http://erp.example.invalid"; }],
    ["URL path", (value) => { value.application.baseUrl += "/app"; }],
    ["URL credentials", (value) => { value.application.baseUrl = "https://user:password@erp.example.invalid"; }],
    ["localhost production", (value) => { value.application = { environment: "production", baseUrl: "https://localhost:3000" }; }]
  ])("rejects unsafe or unsupported %s", (_, mutate) => {
    const value = clone(); mutate(value);
    expect(() => validateDeploymentManifest(value)).toThrow();
  });

  it.each(["password", "serviceRoleKey", "accessToken"])("rejects misplaced %s without exposing its value", (key) => {
    const value = { ...clone(), [key]: "synthetic-secret-never-log" };
    try { validateDeploymentManifest(value); throw new Error("Expected invalid manifest"); }
    catch (error) {
      expect(error.name).toBe("DeploymentManifestError");
      expect(error.message).not.toContain("synthetic-secret-never-log");
      expect(error.stack).not.toContain("synthetic-secret-never-log");
    }
  });

  it("keeps false flags for disabled modules in the customer settings preview", () => {
    const { target } = validateDeploymentManifest(clone());
    const preview = settingsPreview(target);
    expect(preview.modules.projects).toBe(false);
    expect(preview.modules.warehouse).toBe(true);
    expect(preview.modules.industryPreset).toBe("garment");
    expect(preview.organization.companyName).toBe("Công ty May Mẫu");
    expect(Object.keys(preview.modules)).toHaveLength(moduleKeys.length + 1);
    for (const [group, value] of Object.entries(preview)) {
      expect(() => parseSystemSettingsGroup(group, { ...defaultSystemSettings[group], ...value })).not.toThrow();
    }
  });

  it("allows a custom shipped capability selection without changing the preset", () => {
    const value = clone(); value.enabledModules = [];
    expect(Object.values(settingsPreview(validateDeploymentManifest(value).target).modules).filter((flag) => flag === true)).toHaveLength(0);
  });

  it("fingerprints configuration independent of JSON property order", () => {
    const { target } = validateDeploymentManifest(clone());
    const reversed = Object.fromEntries(Object.entries(target).reverse());
    expect(manifestFingerprint(target)).toBe(manifestFingerprint(reversed));
    expect(manifestFingerprint({ ...target, enabledModules: [] })).not.toBe(manifestFingerprint(target));
  });
});

describe("deployment command target selection", () => {
  it("supports documented defaults and separate customer files", () => {
    expect(deploymentArguments([]).manifest).toBe("supabase/deployments/dtech-erp.json");
    const args = deploymentArguments(["--manifest=supabase/deployments/customer.example.json", "--environment-file=.env.customer.local", "--credentials-file=.env.customer.admin.local"], ["credentials-file"]);
    expect(() => assertExplicitInstanceFiles(args, { credentials: true })).not.toThrow();
  });

  it("requires explicit secret file selection for another customer", () => {
    const args = deploymentArguments(["--manifest=supabase/deployments/customer.example.json"]);
    expect(() => assertExplicitInstanceFiles(args)).toThrow(/environment-file/);
    expect(() => assertExplicitInstanceFiles({ ...args, "environment-file": ".env.customer.local" }, { credentials: true })).toThrow(/credentials-file/);
  });

  it("refuses explicit reuse of the default DTech files for another customer", () => {
    const args = { manifest: "supabase/deployments/customer.example.json", "environment-file": ".env.local", "credentials-file": ".env.admin.local" };
    expect(() => assertExplicitInstanceFiles(args, { credentials: true })).toThrow(/Không dùng file mặc định/);
    expect(() => assertExplicitInstanceFiles({ ...args, "environment-file": ".env.customer.local" }, { credentials: true })).toThrow();
  });

  it.each(["../outside.json", "C:/outside.json"])("rejects workspace escape %s", (filename) => expect(() => workspaceFile(filename)).toThrow());

  it.each(["customer.env", ".env", ".env.production", "nested/.env.customer.local"])("refuses a potentially tracked secret file %s", (filename) => expect(() => workspaceFile(filename, "environment")).toThrow());

  it("does not put application secrets and admin credentials in the same file", () => {
    expect(() => deploymentArguments(["--environment-file=.env.customer.local", "--credentials-file=.env.customer.local"], ["credentials-file"])).toThrow(/phải khác/);
  });

  it("rejects undeclared options without echoing values", () => {
    try { deploymentArguments(["--password=synthetic-secret-never-log"]); throw new Error("Expected failure"); }
    catch (error) { expect(error.name).toBe("DeploymentManifestError"); expect(error.message).not.toContain("synthetic-secret-never-log"); }
  });

  it("does not accept another target's environment", () => {
    const { target } = validateDeploymentManifest(clone());
    expect(() => assertDeploymentEnvironment(target, { NEXT_PUBLIC_SUPABASE_URL: "https://different.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture" })).toThrow(/không khớp/);
    expect(() => assertDeploymentEnvironment(target, { NEXT_PUBLIC_SUPABASE_URL: target.apiUrl })).toThrow(/secret/);
    expect(() => assertDeploymentEnvironment(target, { NEXT_PUBLIC_SUPABASE_URL: target.apiUrl, SUPABASE_SECRET_KEY: "fixture" })).not.toThrow();
  });
});

describe("local deployment plan", () => {
  it("requires a separate environment filename for a full customer plan", async () => {
    const loaded = await loadDeploymentManifest("supabase/deployments/customer.example.json");
    await expect(createDeploymentPlan(loaded)).rejects.toThrow(/environment-file/);
    await expect(createDeploymentPlan(loaded, { envFile: ".env.local" })).rejects.toThrow(/Không dùng file mặc định/);
    await expect(createDeploymentPlan(loaded, { validateOnly: true })).resolves.toMatchObject({ valid: true, appliesChanges: false });
  });

  it("only inspects source migration files and a public customer manifest", async () => {
    const loaded = await loadDeploymentManifest("supabase/deployments/customer.example.json");
    const plan = await createDeploymentPlan(loaded, { envFile: ".env.customer.local" });
    expect(plan).toMatchObject({ valid: true, dryRun: true, networkAccess: false, appliesChanges: false, createsProject: false, includesDevelopmentSeed: false });
    expect(plan.migrations.count).toBeGreaterThan(0);
    expect(plan.migrations.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.settingsPreview.modules.projects).toBe(false);
    expect(plan.envFile).toBe(".env.customer.local");
    expect(JSON.stringify(plan)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(path.isAbsolute(workspace)).toBe(true);
  });

  it("supports validation alone without pretending it checked a database", async () => {
    const loaded = await loadDeploymentManifest();
    const plan = await createDeploymentPlan(loaded, { validateOnly: true });
    expect(plan).not.toHaveProperty("migrations");
    expect(plan).not.toHaveProperty("databaseConnected");
    expect(plan.appliesChanges).toBe(false);
  });
});
