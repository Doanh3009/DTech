import { desktopNavigation, filterGroupsByAccess, type NavigationIcon, type NavigationItem } from "@/config/navigation";
import { applicationForPath, visibleApplications, type ApplicationDefinition } from "@/config/moduleRegistry";
import type { SystemSettingsDocument } from "@/config/systemSettings";
import { defaultDashboardSettings, resolveDashboardProfile } from "@/features/dashboard/registry";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { canSubmitPersonalAttendance } from "@/lib/auth/applicationAccess";

export interface MobileNavDestination {
  href: string;
  label: string;
  icon: NavigationIcon;
  exact?: boolean;
  quick?: boolean;
  slot?: number;
  action?: "applications";
  routePrefixes?: readonly string[];
}

export interface MobileNavigationModel {
  mode: "personal" | "supervisor" | "work";
  label: string;
  direct: MobileNavDestination[];
  secondary: MobileNavDestination[];
}

export function canUseWorkerAttendance(user: AuthenticatedUser): boolean {
  return can(user.permissions, "worker_attendance.create");
}

export function isMobilePersonalRoute(pathname: string, user: AuthenticatedUser): boolean {
  if (pathname === "/accounting/payslips" || pathname.startsWith("/accounting/payslips/")) {
    return !["accounting.access", "payroll.view", "payroll.create", "salary.view"].some((permission) => user.permissions.some((item) => item === permission));
  }
  const personalPaths = [
    "/personal", "/profile", "/messages", "/notifications",
    "/attendance/me", "/attendance/quick", "/attendance/history",
    "/attendance/requests", "/attendance/photos",
    "/leave", "/accounting/payslips", "/personal/payslips"
  ];
  if (personalPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return !pathname.startsWith("/leave/manage") && !pathname.startsWith("/leave/adjustments") && !pathname.startsWith("/leave/balances");
  }
  return canUseWorkerAttendance(user) && (pathname === "/worker-attendance" || pathname.startsWith("/worker-attendance/"));
}

export function isMobileDestinationActive(pathname: string, item: MobileNavDestination, destinations: readonly MobileNavDestination[]): boolean {
  const href = item.href.split("?")[0];
  if (pathname === href) return true;
  if (item.exact || !pathname.startsWith(`${href}/`)) return false;
  return !destinations.some((other) => {
    const otherHref = other.href.split("?")[0];
    return otherHref !== href && otherHref.length > href.length && (pathname === otherHref || pathname.startsWith(`${otherHref}/`));
  });
}

export function activeMobileDestination(pathname: string, model: MobileNavigationModel): MobileNavDestination | undefined {
  const matching = model.direct.find((item) => !item.action && isMobileDestinationActive(pathname, item, model.direct));
  if (matching) return matching;
  const applicationMatch = model.direct.find((item) => item.routePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  if (applicationMatch) return applicationMatch;
  if (pathname.startsWith("/worker-attendance/")) return model.direct.find((item) => item.href.startsWith("/worker-attendance"));
  if (pathname.startsWith("/attendance/")) return model.direct.find((item) => item.href === "/attendance/history") ?? model.direct.find((item) => item.href === "/personal");
  if (["/leave", "/personal", "/profile", "/accounting/payslips", "/notifications"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return model.direct.find((item) => item.href === "/personal");
  return undefined;
}

type MobileNavigationSettings = Partial<Pick<SystemSettingsDocument, "modules" | "navigation" | "dashboard">>;

const applicationLabels: Partial<Record<ApplicationDefinition["id"], string>> = {
  overview: "Tổng quan", "human-resources": "Nhân sự", projects: "Công trường",
  "import-export": "XNK", operations: "Điều hành", system: "Quản trị"
};

function destination(item: NavigationItem): MobileNavDestination {
  return { href: item.href, label: item.mobileLabel ?? item.label, icon: item.icon };
}

export function mobileApplicationDestination(application: ApplicationDefinition, user: AuthenticatedUser): string | undefined {
  if (application.id !== "projects") return application.defaultRoute;
  if (application.defaultRoute.startsWith("/project-monitoring") && ["project_monitoring.view", "project_monitoring.view_all", "project_issue.view"].some((permission) => user.permissions.some((item) => item === permission))) return application.defaultRoute;
  if (can(user.permissions, "project.view")) return application.defaultRoute;
  if (can(user.permissions, "worker_attendance.view")) return "/worker-attendance/today";
  return undefined;
}

export function resolveMobileNavigation(pathname: string, user: AuthenticatedUser, settings: MobileNavigationSettings = {}): MobileNavigationModel {
  const supervisor = canUseWorkerAttendance(user);
  const applications = visibleApplications(user, settings.modules).filter((application) => mobileApplicationDestination(application, user) !== undefined);
  const accessibleItems = filterGroupsByAccess(desktopNavigation, user.permissions, settings.modules, settings.navigation).flatMap((group) => group.items);
  const businessApplications = applications.filter((application) => application.id !== "attendance" && application.id !== "overview");
  const currentApplication = applicationForPath(pathname);
  const profile = resolveDashboardProfile(user, settings.dashboard ?? defaultDashboardSettings);
  const roleApplications: Record<string, ApplicationDefinition["id"]> = {
    management: "overview", supervisor: "projects", hr: "human-resources",
    warehouse: "warehouse", accounting: "accounting", import_export: "import-export"
  };
  const contextualApplication = !isMobilePersonalRoute(pathname, user)
    ? applications.find((application) => application.id === currentApplication.id)
    : undefined;
  const workApplication = contextualApplication && contextualApplication.id !== "attendance" && contextualApplication.id !== "overview"
    ? contextualApplication
    : applications.find((application) => application.id === roleApplications[profile] && (profile !== "employee"))
      ?? businessApplications[0];
  const workItems = workApplication ? accessibleItems
    .filter((item) => applicationForPath(item.href).id === workApplication.id)
    .filter((item) => !item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"))
    .sort((first, second) => (first.mobilePriority ?? 99) - (second.mobilePriority ?? 99)) : [];
  const direct: MobileNavDestination[] = [{ href: "/personal", label: "Cá nhân", icon: "UserRound" }];
  const workHref = workApplication ? mobileApplicationDestination(workApplication, user) : undefined;
  if (workApplication && workHref) {
    direct.push({ href: workHref, label: workHref === "/worker-attendance/today" ? "Điểm danh" : applicationLabels[workApplication.id] ?? workApplication.label, icon: workHref === "/worker-attendance/today" ? "UsersRound" : workApplication.icon, routePrefixes: workApplication.routePrefixes.filter((prefix) => !["/notifications", "/profile"].includes(prefix)) });
    const workerItem = supervisor && can(user.permissions, "worker_attendance.view") && settings.modules?.projects !== false
      ? { href: "/worker-attendance/today", label: "Điểm danh", icon: "UsersRound" as const, routePrefixes: ["/worker-attendance"] }
      : undefined;
    const nextWorkItem = workApplication.id === "overview"
      ? accessibleItems.find((item) => item.href === "/approvals") ?? accessibleItems.find((item) => item.href === "/project-monitoring")
      : workItems.find((item) => item.href !== workHref);
    const next = workerItem && workApplication.id === "projects" && workerItem.href !== workHref ? workerItem
      : nextWorkItem ? destination(nextWorkItem)
        : canSubmitPersonalAttendance(user.permissions) && settings.modules?.attendance !== false
          ? { href: "/attendance/quick", label: "Chấm công", icon: "Camera" as const, quick: true }
          : undefined;
    if (next) direct.push(next);
  } else {
    const history = accessibleItems.find((item) => item.href === "/attendance/history");
    if (history) direct.push({ ...destination(history), label: "Lịch công" });
    if (canSubmitPersonalAttendance(user.permissions) && settings.modules?.attendance !== false) direct.push({ href: "/attendance/quick", label: "Chấm công", icon: "Camera", quick: true });
  }
  if (can(user.permissions, "chat.access")) direct.push({ href: "/messages", label: "Tin nhắn", icon: "MessageCircle" });
  else if (can(user.permissions, "notification.view") || can(user.permissions, "notification.self.view")) direct.push({ href: "/notifications", label: "Thông báo", icon: "Bell" });
  if (direct.length < 3) direct.push({ href: "/profile", label: "Tài khoản", icon: "UserRound" });
  const primary = direct.slice(0, 4);
  primary.push({ href: "/applications", label: "Ứng dụng", icon: "Grid2X2", action: "applications" });
  return {
    mode: workApplication ? supervisor && workApplication.id === "projects" ? "supervisor" : "work" : "personal",
    label: workApplication ? "Điều hướng công việc" : "Điều hướng cá nhân",
    direct: primary.map((item, index) => ({ ...item, slot: index + 1 })),
    secondary: workItems.filter((item) => !primary.some((entry) => entry.href === item.href)).map(destination)
  };
}
