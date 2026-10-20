import type { RealtimeDomain } from "@/lib/realtime/coordinator";

const routes: Array<[string, RealtimeDomain]> = [
  ["/project-monitoring", "projects"], ["/worker-attendance", "worker-attendance"],
  ["/import-export", "import-export"], ["/notifications", "notifications"],
  ["/approvals", "approvals"], ["/attendance", "attendance"], ["/employees", "employees"],
  ["/timesheets", "timesheets"], ["/shifts", "timesheets"], ["/leave", "leave"],
  ["/projects", "projects"], ["/warehouse", "warehouse"], ["/dashboard", "dashboard"],
  ["/system-admin", "settings"], ["/settings", "settings"]
];

export function realtimeDomainForPath(pathname: string): RealtimeDomain | undefined {
  return routes.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}
