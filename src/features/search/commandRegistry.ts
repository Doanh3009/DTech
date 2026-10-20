import { desktopNavigation } from "@/config/navigation";
import { commandActions } from "@/features/dashboard/registry";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";

export type CommandType = "NAVIGATE" | "CREATE_ROUTE" | "OPEN_SEARCH";

export interface AppCommand {
  key: string;
  label: string;
  keywords: string[];
  requiredPermission: Permission;
  href: string;
  type: CommandType;
}

const navigationCommands: AppCommand[] = desktopNavigation.flatMap((group) => group.items.map((item) => ({
  key: `navigate:${item.href}`,
  label: `Đi đến ${item.label}`,
  keywords: [group.label, item.label, item.href],
  requiredPermission: item.requiredPermission,
  href: item.href,
  type: "NAVIGATE" as const
})));

const createCommands: AppCommand[] = commandActions.map((action) => ({
  key: `create:${action.key}`,
  label: action.label,
  keywords: ["tạo mới", action.label],
  requiredPermission: action.requiredPermission,
  href: action.href,
  type: "CREATE_ROUTE"
}));

export const commandRegistry: AppCommand[] = [
  { key: "search", label: "Mở trang tìm kiếm", keywords: ["tìm", "search"], requiredPermission: "dashboard.view", href: "/search", type: "OPEN_SEARCH" },
  ...navigationCommands,
  ...createCommands
];

export function commandsForUser(user: AuthenticatedUser, query = ""): AppCommand[] {
  const normalized = query.trim().toLocaleLowerCase("vi");
  return commandRegistry.filter((command) => can(user.permissions, command.requiredPermission) && (!normalized || `${command.label} ${command.keywords.join(" ")}`.toLocaleLowerCase("vi").includes(normalized)));
}
