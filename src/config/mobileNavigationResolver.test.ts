import { describe, expect, it } from "vitest";

import { activeMobileDestination, canUseWorkerAttendance, isMobileDestinationActive, isMobilePersonalRoute, resolveMobileNavigation, type MobileNavDestination } from "@/config/mobileNavigationResolver";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { applicationForPath } from "@/config/moduleRegistry";

function user(permissions: Permission[]): AuthenticatedUser {
  return { id: "mobile-user", username: "mobile", displayName: "Mobile User", email: "mobile@example.com", status: "active", permissions };
}

describe("personal mobile navigation", () => {
  it.each(["/personal", "/attendance/quick", "/messages/one", "/accounting/payslips"])("keeps business destinations within the open module on %s", (path) => {
    const model = resolveMobileNavigation(path, user(["attendance.self.view", "attendance.self.create", "chat.access", "payslip.self.view"]));
    const owner = applicationForPath(path).id;
    expect(model.mode).toBe(owner === "attendance" ? "personal" : "work");
    expect(model.direct.filter((item) => !item.action).every((item) => applicationForPath(item.href).id === owner)).toBe(true);
    expect(model.direct.at(-1)).toMatchObject({ href: "/applications", action: "applications", label: "Nghiệp vụ" });
    if (owner === "attendance") expect(model.direct).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/attendance/quick", quick: true })]));
  });

  it("exposes project work and worker attendance for a permitted supervisor", () => {
    const supervisor = resolveMobileNavigation("/worker-attendance/today", user(["project.view", "worker_attendance.view", "worker_attendance.create", "attendance.self.create", "chat.access"]));
    expect(supervisor.mode).toBe("supervisor");
    expect(supervisor.direct).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/projects" }), expect.objectContaining({ href: "/worker-attendance/today" })]));
    expect(supervisor.direct.some((item) => item.href === "/messages" || item.href === "/personal")).toBe(false);
    expect(canUseWorkerAttendance(user(["worker_attendance.create"]))).toBe(true);
    expect(canUseWorkerAttendance(user(["project.view"]))).toBe(false);
  });

  it("recognizes a conversation inside the global message entry", () => {
    const item: MobileNavDestination = { href: "/messages", label: "Tin nhắn", icon: "MessageCircle" };
    expect(isMobileDestinationActive("/messages/one", item, [item])).toBe(true);
  });

  it.each([
    ["/profile/security", "/profile"],
    ["/messages/one", "/messages"],
    ["/attendance/quick", "/attendance/quick"],
    ["/attendance/history/2026-10-03", "/attendance/history"],
    ["/attendance/requests", "/attendance/history"],
    ["/leave/new", "/leave"]
  ])("selects one contextual mobile destination on %s", (path, expected) => {
    const model = resolveMobileNavigation(path, user(["attendance.self.view", "attendance.self.create", "chat.access", "profile.view", "leave.self.view"]));
    expect(activeMobileDestination(path, model)?.href).toBe(expected);
  });

  it("uses the supervisor destination for worker session details", () => {
    const model = resolveMobileNavigation("/worker-attendance/sessions/one", user(["worker_attendance.view", "worker_attendance.create"]));
    expect(activeMobileDestination("/worker-attendance/sessions/one", model)?.href).toBe("/worker-attendance/today");
  });

  it("prefers an exact child destination over its parent", () => {
    const destinations: MobileNavDestination[] = [{ href: "/attendance", label: "Công", icon: "Camera" }, { href: "/attendance/history", label: "Lịch", icon: "CalendarRange" }];
    expect(isMobileDestinationActive("/attendance/history", destinations[0], destinations)).toBe(false);
    expect(isMobileDestinationActive("/attendance/history", destinations[1], destinations)).toBe(true);
  });

  it("keeps mobile within personal work and only exposes the documented supervisor workflow", () => {
    const employee = user(["attendance.self.create", "payslip.self.view"]);
    const supervisor = user(["attendance.self.create", "worker_attendance.create"]);
    expect(isMobilePersonalRoute("/attendance/history/2026-10-01", employee)).toBe(true);
    expect(isMobilePersonalRoute("/accounting/payslips/slip", employee)).toBe(true);
    expect(isMobilePersonalRoute("/warehouse", employee)).toBe(false);
    expect(isMobilePersonalRoute("/leave/manage", employee)).toBe(false);
    expect(isMobilePersonalRoute("/worker-attendance/today", employee)).toBe(false);
    expect(isMobilePersonalRoute("/worker-attendance/today", supervisor)).toBe(true);
  });
});
