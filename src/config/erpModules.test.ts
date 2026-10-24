import { describe, expect, it } from "vitest";
import { allFoundationPermissions } from "@/lib/auth/permissions";
import { defaultSystemSettings, isPathEnabled, moduleSettingsSchema } from "@/config/systemSettings";
import { enabledModulePermissions, erpModuleCatalog, erpModuleKeys, industryPresets, moduleForApiPath, modulesForIndustry } from "./erpModules";

describe("ERP deployment capabilities", () => {
  it.each(industryPresets)("accepts the $label profile with exactly its shipped capabilities", (preset) => {
    const modules = moduleSettingsSchema.parse(modulesForIndustry(preset.id));
    expect(erpModuleKeys.filter((key) => modules[key])).toEqual(erpModuleKeys.filter((key) => preset.modules.includes(key)));
    expect(modules.industryPreset).toBe(preset.id);
    expect(preset.modules.every((key) => erpModuleCatalog.some((module) => module.key === key))).toBe(true);
  });

  it("keeps the garment profile separate from the construction capability", () => {
    const modules = modulesForIndustry("garment");
    expect(modules.projects).toBe(false);
    expect(modules.warehouse).toBe(true);
    expect(modules.import_export).toBe(true);
    expect(moduleSettingsSchema.safeParse({ ...modules, manufacturing: true }).success).toBe(false);
  });

  it("preserves old deployments when optional flags have not been saved", () => {
    const legacy = { human_resources: true, attendance: true, projects: false, warehouse: false, import_export: true, reports: true };
    const modules = moduleSettingsSchema.parse(legacy);
    expect(modules.projects).toBe(false);
    expect(modules.warehouse).toBe(false);
    expect(enabledModulePermissions(["salary.view", "chat.access"], modules)).toEqual(["salary.view", "chat.access"]);
  });

  it("removes disabled capabilities without granting new permissions or removing recovery access", () => {
    const modules = { ...defaultSystemSettings.modules, warehouse: false, accounting: false, messaging: false };
    expect(enabledModulePermissions(["warehouse.view", "salary.view", "payslip.self.view", "chat.access", "module.manage", "system_admin.access", "profile.view"], modules)).toEqual(["module.manage", "system_admin.access", "profile.view"]);
    expect(enabledModulePermissions([], defaultSystemSettings.modules)).toEqual([]);
    expect(enabledModulePermissions(allFoundationPermissions, modules)).not.toContain("warehouse.receipt.post");
  });

  it.each([
    ["/api/v1/warehouse/receipts/123", "warehouse"], ["/api/v1/items", "warehouse"],
    ["/api/v1/leave-requests/123/approve", "attendance"], ["/api/v1/approvals/123/approve", "operations"],
    ["/api/v1/accounting/payslips", "accounting"], ["/api/v1/chat/conversations", "messaging"],
    ["/api/v1/report-exports", "reports"]
  ])("guards the actual API namespace %s", (path, module) => expect(moduleForApiPath(path)).toBe(module));

  it("does not gate recovery settings or match similar route names", () => {
    expect(moduleForApiPath("/api/v1/system-settings/modules")).toBeUndefined();
    expect(moduleForApiPath("/api/v1/warehouse-other")).toBeUndefined();
    expect(isPathEnabled("/project-monitoring/issues", { ...defaultSystemSettings.modules, projects: false })).toBe(false);
    expect(isPathEnabled("/personal/payslips", { ...defaultSystemSettings.modules, accounting: false })).toBe(false);
    expect(isPathEnabled("/employees-other", { ...defaultSystemSettings.modules, human_resources: false })).toBe(true);
  });
});
