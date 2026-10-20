import Link from "next/link";
import type { ReactNode } from "react";

import { routeMetaByPath } from "@/config/routeRegistry";
import { cn } from "@/lib/utils/cn";
import { can, type Permission } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

const settingsRoutes = [
  "/settings/organization",
  "/settings/attendance",
  "/settings/roles",
  "/settings/approval-workflows",
  "/settings/export-templates",
  "/settings/integrations",
  "/settings/audit-log"
] as const;

export interface SettingsShellProps {
  activePath: (typeof settingsRoutes)[number] | "/settings/users";
  children: ReactNode;
}

const settingsPermissions: Record<SettingsShellProps["activePath"], readonly Permission[]> = {
  "/settings/users": ["user.view"],
  "/settings/organization": ["organization_settings.view"],
  "/settings/attendance": ["attendance.config.view", "attendance.config.manage"],
  "/settings/roles": ["role.view"],
  "/settings/approval-workflows": ["settings.view", "approval.workflow.manage"],
  "/settings/export-templates": ["export_template.view", "export_template.manage"],
  "/settings/integrations": ["integration.view"],
  "/settings/audit-log": ["audit.view"]
};

export async function SettingsShell({ activePath, children }: SettingsShellProps) {
  const user = await getRequestUser();
  const visibleRoutes = (["/settings/users", ...settingsRoutes] as const).filter((href) => {
    if (!user || !settingsPermissions[href].some((permission) => can(user.permissions, permission))) return false;
    return !["/settings/organization", "/settings/audit-log"].includes(href) || can(user.permissions, "system_admin.access");
  });
  return (
    <div className="settings-shell">
      <aside className="settings-subnav" aria-label="Điều hướng cài đặt">
        <h2>Cấu hình</h2>
        <nav>
          {visibleRoutes.map((href) => (
            <Link aria-current={activePath === href ? "page" : undefined} className={cn(activePath === href && "is-active")} href={href} key={href}>
              {href === "/settings/users" ? "Người dùng" : routeMetaByPath[href].title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="settings-shell__content">{children}</div>
    </div>
  );
}
