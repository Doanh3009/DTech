import type { ModuleSettings } from "@/config/systemSettings";
import type { ApplicationId } from "@/config/moduleIconRegistry";
import type { Permission } from "@/lib/auth/permissions";
import erpRegistry from "./erpRegistry.json";

export type ErpModuleKey = keyof typeof erpRegistry.modules;
export const erpModuleKeys = Object.freeze(Object.keys(erpRegistry.modules)) as readonly [ErpModuleKey, ...ErpModuleKey[]];
export type IndustryKey = keyof typeof erpRegistry.industries;
export const industryKeys = Object.freeze(Object.keys(erpRegistry.industries)) as readonly [IndustryKey, ...IndustryKey[]];

/** The catalog contains shipped capabilities only. Industry roadmaps are separate. */
export const erpModuleCatalog: readonly {
  key: ErpModuleKey;
  label: string;
  applicationId: ApplicationId;
  permissionPrefixes: readonly string[];
}[] = erpModuleKeys.map((key) => ({ ...erpRegistry.modules[key], key, applicationId: erpRegistry.modules[key].applicationId as ApplicationId }));

export interface IndustryPreset {
  id: IndustryKey;
  label: string;
  modules: readonly ErpModuleKey[];
  plannedModules: readonly string[];
}

export const industryPresets: readonly IndustryPreset[] = industryKeys.map((id) => ({ ...erpRegistry.industries[id], id, modules: erpRegistry.industries[id].modules as ErpModuleKey[] }));

export function getIndustryPreset(id?: IndustryKey): IndustryPreset {
  return industryPresets.find((preset) => preset.id === id) ?? industryPresets[0];
}

/** New flags are optional so upgrading a customer's saved configuration preserves access. */
export function isErpModuleEnabled(modules: ModuleSettings, key: ErpModuleKey): boolean {
  return modules[key] !== false;
}

export function modulesForIndustry(id: IndustryKey): ModuleSettings {
  const enabled = new Set(getIndustryPreset(id).modules);
  return { ...Object.fromEntries(erpModuleKeys.map((key) => [key, enabled.has(key)])), industryPreset: id } as ModuleSettings;
}

export function moduleForPermission(permission: Permission): ErpModuleKey | undefined {
  const prefix = permission.split(".")[0];
  return erpModuleCatalog.find((module) => module.permissionPrefixes.includes(prefix))?.key;
}

/** Entitlements narrow RBAC; enabling a module never grants a user's missing permission. */
export function enabledModulePermissions(permissions: readonly Permission[], modules: ModuleSettings): Permission[] {
  return permissions.filter((permission) => {
    const moduleKey = moduleForPermission(permission);
    return !moduleKey || isErpModuleEnabled(modules, moduleKey);
  });
}

const apiModules: Readonly<Record<string, ErpModuleKey>> = {
  employees: "human_resources", hr: "human_resources", insurance: "human_resources",
  attendance: "attendance", shifts: "attendance", "work-calendar": "attendance",
  "timesheet-exceptions": "attendance", "timesheet-periods": "attendance",
  "leave-balances": "attendance", "leave-policies": "attendance", "leave-requests": "attendance", "leave-settlements": "attendance", "leave-types": "attendance", "leave-workflows": "attendance",
  projects: "projects", "project-issues": "projects", "project-monitoring": "projects", "project-updates": "projects", "worker-attendance": "projects",
  warehouse: "warehouse", warehouses: "warehouse", items: "warehouse", "item-categories": "warehouse", uom: "warehouse",
  "import-export": "import_export", "import-contracts": "import_export", partners: "import_export", "shipment-documents": "import_export", shipments: "import_export",
  accounting: "accounting", approvals: "operations", "approval-delegations": "operations", "approval-workflows": "operations", documents: "operations", "document-types": "operations",
  "report-exports": "reports", "report-templates": "reports", chat: "messaging"
};

export function moduleForApiPath(pathname: string): ErpModuleKey | undefined {
  const match = /^\/api\/v1\/([^/]+)(?:\/|$)/.exec(pathname);
  return match ? apiModules[match[1]] : undefined;
}
