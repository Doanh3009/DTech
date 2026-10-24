import {
  desktopNavigation,
  filterGroupsByAccess,
  filterNavigationByPermissions,
  type NavigationGroup,
  type NavigationIcon,
  type NavigationItem
} from "@/config/navigation";
import type { ModuleKey, ModuleSettings, NavigationSettings } from "@/config/systemSettings";
import { isPathEnabled } from "@/config/systemSettings";
import { enabledModulePermissions } from "@/config/erpModules";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { applicationPermissionSets } from "@/lib/auth/applicationAccess";
import { moduleIconRegistry, type ApplicationId, type ModuleIconTone } from "@/config/moduleIconRegistry";

export type { ApplicationId } from "@/config/moduleIconRegistry";

export interface ApplicationDefinition {
  id: ApplicationId;
  label: string;
  icon: NavigationIcon;
  baseRoute: string;
  defaultRoute: string;
  routePrefixes: readonly string[];
  navigationGroups: readonly string[];
  moduleFlag?: ModuleKey;
  requiredAny: readonly Permission[];
  tone: ModuleIconTone;
  accentColor: string;
  accentSoft: string;
  launcher: boolean;
}

export interface LauncherApplication extends ApplicationDefinition {
  accessible: boolean;
}

export const applicationRegistry: readonly ApplicationDefinition[] = [
  { id: "overview", label: "Không gian làm việc", ...moduleIconRegistry.overview, baseRoute: "/applications", defaultRoute: "/applications", routePrefixes: ["/applications", "/dashboard", "/home", "/workspace", "/search"], navigationGroups: [], requiredAny: [], launcher: false },
  { id: "human-resources", label: "Nhân sự", ...moduleIconRegistry["human-resources"], baseRoute: "/employees", defaultRoute: "/employees", routePrefixes: ["/dashboard/hr", "/employees", "/attendance/today", "/attendance/logs", "/timesheets", "/shifts", "/leave/manage", "/settings/attendance", "/settings/leave", "/settings/export-templates"], navigationGroups: ["Nhân sự", "Quản trị công"], moduleFlag: "human_resources", requiredAny: applicationPermissionSets["human-resources"], launcher: true },
  { id: "attendance", label: "Cá nhân", ...moduleIconRegistry.attendance, baseRoute: "/attendance/me", defaultRoute: "/attendance/me", routePrefixes: ["/personal", "/attendance", "/leave"], navigationGroups: ["Cá nhân"], moduleFlag: "attendance", requiredAny: applicationPermissionSets.attendance, launcher: true },
  { id: "projects", label: "Gói / Công trường", ...moduleIconRegistry.projects, baseRoute: "/projects", defaultRoute: "/projects", routePrefixes: ["/projects", "/project-monitoring", "/worker-attendance"], navigationGroups: ["Gói / Công trường"], moduleFlag: "projects", requiredAny: applicationPermissionSets.projects, launcher: true },
  { id: "warehouse", label: "Kho", ...moduleIconRegistry.warehouse, baseRoute: "/warehouse", defaultRoute: "/warehouse/inventory", routePrefixes: ["/dashboard/warehouse", "/warehouse", "/settings/warehouse"], navigationGroups: ["Kho", "Hệ thống"], moduleFlag: "warehouse", requiredAny: applicationPermissionSets.warehouse, launcher: true },
  { id: "import-export", label: "Xuất nhập khẩu", ...moduleIconRegistry["import-export"], baseRoute: "/import-export", defaultRoute: "/import-export/shipments", routePrefixes: ["/dashboard/import-export", "/import-export", "/settings/import-export"], navigationGroups: ["Xuất nhập khẩu", "Hệ thống"], moduleFlag: "import_export", requiredAny: applicationPermissionSets["import-export"], launcher: true },
  { id: "accounting", label: "Kế toán", ...moduleIconRegistry.accounting, baseRoute: "/accounting", defaultRoute: "/accounting/salaries", routePrefixes: ["/accounting"], navigationGroups: ["Kế toán"], moduleFlag: "accounting", requiredAny: applicationPermissionSets.accounting, launcher: true },
  { id: "messaging", label: "Tin nhắn", ...moduleIconRegistry.messaging, baseRoute: "/messages", defaultRoute: "/messages", routePrefixes: ["/messages"], navigationGroups: [], moduleFlag: "messaging", requiredAny: applicationPermissionSets.messaging, launcher: true },
  { id: "operations", label: "Đơn từ & Điều hành", ...moduleIconRegistry.operations, baseRoute: "/approvals", defaultRoute: "/approvals", routePrefixes: ["/dashboard/management", "/approvals", "/documents", "/reports", "/notifications", "/profile"], navigationGroups: ["Quản lý"], requiredAny: applicationPermissionSets.operations, launcher: true },
  { id: "system", label: "Quản trị", ...moduleIconRegistry.system, baseRoute: "/system-admin", defaultRoute: "/system-admin", routePrefixes: ["/system-admin", "/settings"], navigationGroups: ["Hệ thống"], requiredAny: applicationPermissionSets.system, launcher: true }
] as const;

function itemBelongsToApplication(item: NavigationItem, application: ApplicationDefinition): boolean {
  return applicationForPath(item.href).id === application.id;
}

function overviewFirst(items: NavigationItem[]): NavigationItem[] {
  return items.sort((first, second) => Number(second.icon === "LayoutDashboard") - Number(first.icon === "LayoutDashboard"));
}

export function applicationForPath(pathname: string): ApplicationDefinition {
  return applicationRegistry
    .filter((application) => application.routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)))
    .sort((first, second) => {
      const matchLength = (application: ApplicationDefinition) => Math.max(...application.routePrefixes
        .filter((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
        .map((prefix) => prefix.length));
      return matchLength(second) - matchLength(first);
    })[0]
    ?? applicationRegistry[0];
}

export function visibleApplications(
  user: AuthenticatedUser,
  modules?: ModuleSettings
): ApplicationDefinition[] {
  const effectiveUser = modules ? { ...user, permissions: enabledModulePermissions(user.permissions, modules) } : user;
  return applicationRegistry.filter((application) =>
    application.launcher &&
    applicationEnabled(application, modules) &&
    application.requiredAny.some((permission) => can(effectiveUser.permissions, permission))
  ).map((application) => ({ ...application, defaultRoute: applicationDefaultRoute(application, effectiveUser, modules) }));
}

function applicationEnabled(application: ApplicationDefinition, modules?: ModuleSettings): boolean {
  if (!modules) return true;
  if (application.id === "human-resources") return modules.human_resources || modules.attendance;
  if (application.id === "operations") return modules.operations !== false || modules.reports;
  return !application.moduleFlag || modules[application.moduleFlag] !== false;
}

function applicationDefaultRoute(application: ApplicationDefinition, user: AuthenticatedUser, modules?: ModuleSettings): string {
  if (application.id === "human-resources") {
    if (can(user.permissions, "attendance.view_all") || can(user.permissions, "attendance.manage")) return "/attendance/today";
    if (can(user.permissions, "attendance.period.manage")) return "/timesheets";
    if (can(user.permissions, "attendance.adjust")) return "/timesheets/adjustments";
  }
  const firstAccessibleItem = filterNavigationByPermissions(
    desktopNavigation.flatMap((group) => group.items).filter((item) => itemBelongsToApplication(item, application) && (!modules || isPathEnabled(item.href, modules))),
    user.permissions
  )[0];
  return firstAccessibleItem?.href ?? application.defaultRoute;
}

export function applicationsForLauncher(
  user: AuthenticatedUser,
  modules?: ModuleSettings
): LauncherApplication[] {
  const effectiveUser = modules ? { ...user, permissions: enabledModulePermissions(user.permissions, modules) } : user;
  return applicationRegistry
    .filter((application) => application.launcher && applicationEnabled(application, modules))
    .map((application) => ({
      ...application,
      defaultRoute: applicationDefaultRoute(application, effectiveUser, modules),
      accessible: application.requiredAny.some((permission) => can(effectiveUser.permissions, permission))
    }));
}

export function contextualNavigationGroups(
  pathname: string,
  user: AuthenticatedUser,
  modules: ModuleSettings,
  navigation: NavigationSettings
): NavigationGroup[] {
  const application = applicationForPath(pathname);
  const accessibleGroups = filterGroupsByAccess(desktopNavigation, user.permissions, modules, navigation);
  const groups = accessibleGroups
    .filter((group) => application.navigationGroups.includes(group.label))
    .map((group) => ({
      label: application.label,
      items: group.items.filter((item) => itemBelongsToApplication(item, application))
    }))
    .filter((group) => group.items.length > 0);
  const items = overviewFirst(groups.flatMap((group) => group.items));
  if (application.id === "overview") return [];
  if (application.id === "messaging") return [];
  if (application.id === "warehouse") {
    const sections = [
      { label: "VẬN HÀNH KHO", paths: ["/warehouse/inventory", "/warehouse/receipts", "/warehouse/issues", "/warehouse/transfers"] },
      { label: "ĐỐI SOÁT KHO", paths: ["/warehouse/ledger", "/warehouse/adjustments", "/warehouse/stock-counts"] },
      { label: "DANH MỤC & CẤU HÌNH", paths: ["/warehouse/items", "/warehouse/warehouses", "/settings/warehouse"] }
    ];
    return sections.map((section) => ({ label: section.label, items: section.paths.flatMap((path) => items.find((item) => item.href === path) ?? []) }))
      .filter((section) => section.items.length > 0);
  }
  if (application.id === "import-export") {
    const sections = [
      { label: "VẬN HÀNH", paths: ["/import-export/shipments", "/import-export/transport", "/import-export/customs"] },
      { label: "HỒ SƠ & ĐỐI TÁC", paths: ["/import-export/contracts", "/import-export/documents", "/import-export/partners"] },
      { label: "CẤU HÌNH", paths: ["/settings/import-export"] }
    ];
    return sections.map((section) => ({ label: section.label, items: section.paths.flatMap((path) => items.find((item) => item.href === path) ?? []) }))
      .filter((section) => section.items.length > 0);
  }
  if (application.id !== "human-resources") return items.length ? [{ label: application.label, items }] : [];
  const sections = [
    { label: "HỒ SƠ", paths: ["/employees", "/employees/departments", "/employees/positions", "/employees/contracts", "/employees/insurance"] },
    { label: "QUẢN LÝ CÔNG", paths: ["/attendance/today", "/timesheets/matrix", "/timesheets", "/shifts", "/leave/manage", "/timesheets/adjustments", "/settings/attendance"] }
  ];
  return sections.map((section) => ({ label: section.label, items: section.paths.flatMap((path) => items.find((item) => item.href === path) ?? []) }))
    .filter((section) => section.items.length > 0);
}

export function visibleApplicationShortcuts(
  application: ApplicationDefinition,
  user: AuthenticatedUser,
  modules: ModuleSettings,
  navigation: NavigationSettings
): NavigationItem[] {
  return overviewFirst(filterGroupsByAccess(desktopNavigation, user.permissions, modules, navigation)
    .filter((group) => application.navigationGroups.includes(group.label))
    .flatMap((group) => group.items)
    .filter((item) => itemBelongsToApplication(item, application)));
}
