import { desktopNavigation, filterGroupsByAccess, type NavigationIcon, type NavigationItem } from "@/config/navigation";
import { applicationForPath, visibleApplications, type ApplicationDefinition } from "@/config/moduleRegistry";
import type { SystemSettingsDocument } from "@/config/systemSettings";
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
  if (pathname.startsWith("/profile/")) return model.direct.find((item) => item.href === "/profile");
  if (pathname.startsWith("/worker-attendance/")) return model.direct.find((item) => item.href.startsWith("/worker-attendance"));
  if (pathname.startsWith("/attendance/")) return model.direct.find((item) => item.href === "/attendance/history") ?? model.direct.find((item) => item.href === "/personal");
  if (["/leave", "/personal", "/profile", "/accounting/payslips", "/notifications"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return model.direct.find((item) => item.href === "/personal");
  return undefined;
}

type MobileNavigationSettings = Partial<Pick<SystemSettingsDocument, "modules" | "navigation" | "dashboard">>;

function destination(item: NavigationItem): MobileNavDestination {
  return { href: item.href, label: item.mobileLabel ?? item.label, icon: item.icon, exact: item.exact };
}

export function mobileApplicationDestination(application: ApplicationDefinition, user: AuthenticatedUser): string | undefined {
  if (application.id !== "projects") return application.defaultRoute;
  if (application.defaultRoute.startsWith("/project-monitoring") && ["project_monitoring.view", "project_monitoring.view_all", "project_issue.view"].some((permission) => user.permissions.some((item) => item === permission))) return application.defaultRoute;
  if (can(user.permissions, "project.view")) return application.defaultRoute;
  if (can(user.permissions, "worker_attendance.view")) return "/worker-attendance/today";
  return undefined;
}

export function resolveMobileNavigation(pathname: string, user: AuthenticatedUser, settings: MobileNavigationSettings = {}): MobileNavigationModel {
  if (pathname === "/applications") return {
    mode: "work",
    label: "Không gian làm việc",
    direct: [{ href: "/applications", label: "Module", icon: "Grid2X2", exact: true, slot: 1 }],
    secondary: []
  };

  const application = applicationForPath(pathname);
  const accessibleApplication = visibleApplications(user, settings.modules).find((item) => item.id === application.id);
  const workItems = filterGroupsByAccess(desktopNavigation, user.permissions, settings.modules, settings.navigation)
    .flatMap((group) => group.items)
    .filter((item) => applicationForPath(item.href).id === application.id)
    .filter((item) => !item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"))
    .sort((first, second) => (first.mobilePriority ?? 99) - (second.mobilePriority ?? 99));
  const destinations = workItems.map(destination);
  if ((pathname === "/profile" || pathname.startsWith("/profile/")) && can(user.permissions, "profile.view") && !destinations.some((item) => item.href === "/profile")) {
    destinations.unshift({ href: "/profile", label: "Tài khoản", icon: "UserRound" });
  }
  if (application.id === "attendance" && canSubmitPersonalAttendance(user.permissions) && settings.modules?.attendance !== false) {
    const attendanceIndex = destinations.findIndex((item) => item.href === "/attendance/me");
    const quick: MobileNavDestination = { href: "/attendance/quick", label: "Chấm công", icon: "Camera", quick: true };
    if (attendanceIndex >= 0) destinations[attendanceIndex] = quick;
    else destinations.unshift(quick);
  }
  if (!destinations.length && accessibleApplication) {
    const href = mobileApplicationDestination(accessibleApplication, user);
    if (href) destinations.push({ href, label: application.label, icon: application.icon });
  }

  const primary = destinations.slice(0, 4);
  const active = destinations.find((item) => isMobileDestinationActive(pathname, item, destinations));
  if (active && !primary.includes(active)) primary[primary.length - 1] = active;
  primary.push({ href: "/applications", label: "Nghiệp vụ", icon: "Grid2X2", action: "applications" });
  return {
    mode: application.id === "attendance" ? "personal" : application.id === "projects" && canUseWorkerAttendance(user) ? "supervisor" : "work",
    label: `Điều hướng ${application.label}`,
    direct: primary.map((item, index) => ({ ...item, slot: index + 1 })),
    secondary: workItems.filter((item) => !primary.some((entry) => entry.href === item.href)).map(destination)
  };
}
