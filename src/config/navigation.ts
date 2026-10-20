import type { Permission } from "@/lib/auth/permissions";
import { can, createPermissionSet } from "@/lib/auth/permissions";
import { approvalInboxPermissions } from "@/lib/auth/approvalAccess";
import { isPathEnabled, type ModuleSettings, type NavigationSettings } from "@/config/systemSettings";

export type NavigationIcon =
  | "LayoutDashboard"
  | "Users"
  | "Clock3"
  | "CalendarDays"
  | "BriefcaseBusiness"
  | "ClipboardCheck"
  | "Warehouse"
  | "PackagePlus"
  | "PackageMinus"
  | "Repeat"
  | "Boxes"
  | "Ship"
  | "CheckSquare"
  | "UserCog"
  | "ShieldCheck"
  | "Settings"
  | "Bell"
  | "UserRound"
  | "WalletCards"
  | "MessageCircle"
  | "Building2"
  | "IdCard"
  | "FileSignature"
  | "HeartPulse"
  | "CalendarOff"
  | "CalendarCheck"
  | "Send"
  | "TableProperties"
  | "CalendarRange"
  | "CalendarClock"
  | "Timer"
  | "History"
  | "FileClock"
  | "Newspaper"
  | "HardHat"
  | "Package"
  | "ClipboardPenLine"
  | "Scale"
  | "ScanLine"
  | "BookOpenCheck"
  | "Truck"
  | "Handshake"
  | "FolderArchive"
  | "Landmark"
  | "SlidersHorizontal"
  | "UsersRound"
  | "Calculator"
  | "ReceiptText"
  | "Library"
  | "ChartNoAxesCombined"
  | "ChartSpline"
  | "Cable"
  | "PackageCheck"
  | "ShieldAlert"
  | "Grid2X2"
  | "Camera";

export interface NavigationItem {
  label: string;
  href: string;
  icon: NavigationIcon;
  requiredPermission: Permission;
  alternativePermission?: Permission;
  alternativePermissions?: readonly Permission[];
  excludedPermissions?: readonly Permission[];
  exact?: boolean;
  mobilePriority?: number;
  mobileLabel?: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const desktopNavigation: NavigationGroup[] = [
  {
    label: "Tổng quan",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
        requiredPermission: "dashboard.view",
        alternativePermissions: ["salary.view", "payroll.view", "payslip.self.view"],
        exact: true
      }
    ]
  },
  {
    label: "Nhân sự",
    items: [
      {
        label: "Nhân viên",
        href: "/employees",
        icon: "Users",
        requiredPermission: "employee.view",
        mobilePriority: 1,
        exact: true
      },
      {
        label: "Phòng ban",
        href: "/employees/departments",
        icon: "Building2",
        requiredPermission: "employee.view",
        alternativePermission: "department.manage"
      },
      {
        label: "Chức vụ",
        href: "/employees/positions",
        icon: "IdCard",
        requiredPermission: "employee.view",
        alternativePermission: "position.manage"
      },
      {
        label: "Hợp đồng",
        href: "/employees/contracts",
        icon: "FileSignature",
        requiredPermission: "contract.view"
      },
      {
        label: "Bảo hiểm xã hội",
        href: "/employees/insurance",
        icon: "HeartPulse",
        requiredPermission: "insurance.view"
      },
    ]
  },
  {
    label: "Cá nhân",
    items: [
      {
        label: "Chấm công",
        href: "/attendance/me",
        icon: "Clock3",
        requiredPermission: "attendance.self",
        mobilePriority: 1,
        alternativePermissions: ["attendance.self.view", "attendance.self.create"]
      },
      {
        label: "Lịch công của tôi",
        href: "/attendance/history",
        icon: "CalendarRange",
        requiredPermission: "attendance.self.view",
        mobilePriority: 2,
        alternativePermission: "attendance.self_history"
      },
      {
        label: "Nghỉ phép",
        href: "/leave",
        icon: "CalendarOff",
        requiredPermission: "leave.self.view",
        mobilePriority: 3,
        alternativePermission: "leave.self.create"
      },
      {
        label: "Đơn của tôi",
        href: "/attendance/requests",
        icon: "Send",
        requiredPermission: "attendance.self",
        mobilePriority: 4,
        alternativePermission: "attendance.self_request"
      },
      {
        label: "Phiếu lương của tôi",
        href: "/personal/payslips",
        icon: "ReceiptText",
        requiredPermission: "payslip.self.view",
        mobilePriority: 5,
        excludedPermissions: ["accounting.access", "payroll.view", "payroll.create", "salary.view"]
      },
      {
        label: "Thông báo",
        href: "/attendance/notifications",
        icon: "Bell",
        requiredPermission: "attendance.self",
        alternativePermissions: ["attendance.self.view", "attendance.self.create", "attendance.self_history", "attendance.self_request"]
      }
    ]
  },
  {
    label: "Quản trị công",
    items: [
      {
        label: "Kiểm tra công",
        href: "/attendance/today",
        icon: "Timer",
        requiredPermission: "attendance.view_all",
        mobilePriority: 2,
        alternativePermission: "attendance.manage"
      },
      {
        label: "Bảng công",
        href: "/timesheets/matrix",
        icon: "TableProperties",
        requiredPermission: "timesheet.view_all",
        mobilePriority: 5,
        alternativePermissions: ["timesheet.view_team", "timesheet.view_all", "attendance.view_all", "attendance.period.manage"]
      },
      {
        label: "Kỳ công",
        href: "/timesheets",
        icon: "CalendarRange",
        requiredPermission: "timesheet.view_all",
        alternativePermissions: ["timesheet.view_team", "timesheet.view_all", "attendance.view_all", "attendance.period.manage"],
        exact: true
      },
      {
        label: "Ca làm",
        href: "/shifts",
        icon: "CalendarClock",
        requiredPermission: "shift.view",
        mobilePriority: 3
      },
      {
        label: "Quản lý nghỉ phép",
        href: "/leave/manage",
        icon: "CalendarCheck",
        requiredPermission: "leave.view_all",
        alternativePermissions: ["leave.view_team", "leave.approve_all"],
        mobilePriority: 4,
        exact: true
      },
      {
        label: "Điều chỉnh công",
        href: "/timesheets/adjustments",
        icon: "ClipboardPenLine",
        requiredPermission: "timesheet.adjust",
        alternativePermissions: ["attendance.adjust", "attendance.manage", "attendance.view_all"]
      },
      {
        label: "Cấu hình chấm công",
        href: "/settings/attendance",
        icon: "SlidersHorizontal",
        requiredPermission: "attendance.config.view",
        alternativePermission: "attendance.config.manage"
      },
    ]
  },
  {
    label: "Gói / Công trường",
    items: [
      {
        label: "Gói / Công trường",
        href: "/projects",
        icon: "BriefcaseBusiness",
        requiredPermission: "project.view",
        mobilePriority: 1,
        exact: true
      },
      {
        label: "Theo dõi dự án",
        href: "/project-monitoring",
        icon: "ChartNoAxesCombined",
        requiredPermission: "project_monitoring.view",
        alternativePermissions: ["project_monitoring.view_all", "project_issue.view"],
        mobilePriority: 2
      },
      {
        label: "Điểm danh",
        href: "/worker-attendance/today",
        icon: "ClipboardCheck",
        requiredPermission: "worker_attendance.view",
        alternativePermissions: ["worker_attendance.self_scope", "worker_attendance.view_project", "worker_attendance.view_all"],
        mobilePriority: 3
      },
    ]
  },
  {
    label: "Kho",
    items: [
      {
        label: "Tổng quan kho",
        href: "/warehouse",
        exact: true,
        icon: "LayoutDashboard",
        requiredPermission: "warehouse.view"
      },
      {
        label: "Tồn kho",
        href: "/warehouse/inventory",
        icon: "Boxes",
        requiredPermission: "warehouse.view",
        mobilePriority: 1
      },
      {
        label: "Hàng hóa",
        href: "/warehouse/items",
        icon: "Package",
        requiredPermission: "warehouse.item.view"
      },
      {
        label: "Nhập kho",
        href: "/warehouse/receipts",
        icon: "PackagePlus",
        requiredPermission: "warehouse.receipt.view",
        mobilePriority: 2
      },
      {
        label: "Xuất kho",
        href: "/warehouse/issues",
        icon: "PackageMinus",
        requiredPermission: "warehouse.issue.view",
        mobilePriority: 3
      },
      {
        label: "Chuyển kho",
        href: "/warehouse/transfers",
        icon: "Repeat",
        requiredPermission: "warehouse.transfer.view",
        mobilePriority: 4
      },
      {
        label: "Kho hàng",
        href: "/warehouse/warehouses",
        icon: "Warehouse",
        requiredPermission: "warehouse.view"
      },
      {
        label: "Điều chỉnh tồn",
        href: "/warehouse/adjustments",
        icon: "Scale",
        requiredPermission: "warehouse.adjustment.view"
      },
      {
        label: "Kiểm kê",
        href: "/warehouse/stock-counts",
        icon: "ScanLine",
        requiredPermission: "warehouse.stock_count.view"
      },
      {
        label: "Sổ kho",
        href: "/warehouse/ledger",
        icon: "BookOpenCheck",
        requiredPermission: "warehouse.ledger.view"
      }
    ]
  },
  {
    label: "Xuất nhập khẩu",
    items: [
      {
        label: "Lô hàng",
        href: "/import-export/shipments",
        icon: "Ship",
        requiredPermission: "shipment.view",
        mobilePriority: 1
      },
      {
        label: "Vận chuyển",
        href: "/import-export/transport",
        icon: "Truck",
        requiredPermission: "shipment.view",
        mobilePriority: 2
      },
      {
        label: "Hợp đồng mua hàng",
        href: "/import-export/contracts",
        icon: "Handshake",
        requiredPermission: "import_contract.view"
      },
      {
        label: "Chứng từ",
        href: "/import-export/documents",
        icon: "FolderArchive",
        requiredPermission: "shipment_document.view",
        mobilePriority: 3
      },
      {
        label: "Thông quan",
        href: "/import-export/customs",
        icon: "Landmark",
        requiredPermission: "customs.view"
      },
      {
        label: "Đối tác",
        href: "/import-export/partners",
        icon: "UsersRound",
        requiredPermission: "partner.view"
      }
    ]
  },
  {
    label: "Kế toán",
    items: [
      { label: "Kỳ lương", href: "/accounting/payroll", icon: "Calculator", requiredPermission: "payroll.view", alternativePermission: "payroll.create", mobilePriority: 1 },
      { label: "Hồ sơ lương", href: "/accounting/salaries", icon: "WalletCards", requiredPermission: "salary.view", mobilePriority: 2 },
      { label: "Phiếu lương", href: "/accounting/payslips", icon: "ReceiptText", requiredPermission: "payroll.view", mobilePriority: 3 }
    ]
  },
  {
    label: "Quản lý",
    items: [
      {
        label: "Phê duyệt",
        href: "/approvals",
        icon: "CheckSquare",
        requiredPermission: "approval.inbox.view",
        alternativePermissions: approvalInboxPermissions
      },
      {
        label: "Tài liệu",
        href: "/documents",
        icon: "Library",
        requiredPermission: "document.view"
      },
      {
        label: "Báo cáo",
        href: "/reports",
        icon: "ChartNoAxesCombined",
        requiredPermission: "report.view"
      }
    ]
  },
  {
    label: "Hệ thống",
    items: [
      {
        label: "Cấu hình nghiệp vụ",
        href: "/settings",
        icon: "SlidersHorizontal",
        requiredPermission: "settings.view",
        exact: true
      },
      {
        label: "Người dùng",
        href: "/settings/users",
        icon: "UserCog",
        requiredPermission: "user.view"
      },
      {
        label: "Vai trò & phân quyền",
        href: "/settings/roles",
        icon: "ShieldCheck",
        requiredPermission: "role.view"
      },
      {
        label: "Trung tâm quản trị",
        href: "/system-admin",
        icon: "Settings",
        requiredPermission: "system_admin.access"
      },
      {
        label: "Tích hợp",
        href: "/settings/integrations",
        icon: "Cable",
        requiredPermission: "integration.view"
      },
      {
        label: "Cấu hình kho",
        href: "/settings/warehouse",
        icon: "Warehouse",
        requiredPermission: "warehouse.master.manage"
      },
      {
        label: "Cấu hình XNK",
        href: "/settings/import-export",
        icon: "PackageCheck",
        requiredPermission: "module.manage"
      },
      {
        label: "Nhật ký hệ thống",
        href: "/settings/audit-log",
        icon: "ShieldAlert",
        requiredPermission: "audit.view"
      }
    ]
  }
];

export const mobileNavigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    requiredPermission: "dashboard.view",
    alternativePermissions: ["salary.view", "payroll.view", "payslip.self.view"],
    exact: true
  },
  {
    label: "Chấm công",
    href: "/attendance",
    icon: "Clock3",
    requiredPermission: "attendance.self"
  },
  {
    label: "Điểm danh",
    href: "/worker-attendance",
    icon: "ClipboardCheck",
    requiredPermission: "worker_attendance.view"
  },
  {
    label: "Thông báo",
    href: "/notifications",
    icon: "Bell",
    requiredPermission: "notification.view",
    alternativePermission: "notification.self.view"
  },
  {
    label: "Cá nhân",
    href: "/profile",
    icon: "UserRound",
    requiredPermission: "profile.view"
  }
];

export function filterNavigationByPermissions<T extends NavigationItem>(
  items: readonly T[],
  permissions: readonly Permission[]
): T[] {
  const permissionSet = createPermissionSet(permissions);
  return items.filter((item) => can(permissionSet, item.requiredPermission)
    || Boolean(item.alternativePermission && can(permissionSet, item.alternativePermission))
    || Boolean(item.alternativePermissions?.some((permission) => can(permissionSet, permission))))
    .filter((item) => !item.excludedPermissions?.some((permission) => can(permissionSet, permission)));
}

export function filterGroupsByPermissions(
  groups: readonly NavigationGroup[],
  permissions: readonly Permission[]
): NavigationGroup[] {
  return filterGroupsByAccess(groups, permissions);
}

export function filterGroupsByAccess(
  groups: readonly NavigationGroup[],
  permissions: readonly Permission[],
  modules?: ModuleSettings,
  navigation?: NavigationSettings
): NavigationGroup[] {
  const order = new Map<string, number>(navigation?.itemOrder.map((href, index) => [href, index]) ?? []);
  const hidden = new Set<string>(navigation?.hiddenItems ?? []);
  return groups
    .map((group) => ({
      ...group,
      items: filterNavigationByPermissions(group.items, permissions)
        .filter((item) => !modules || isPathEnabled(item.href, modules))
        .filter((item) => !hidden.has(item.href))
        .sort((first, second) => (order.get(first.href) ?? 999) - (order.get(second.href) ?? 999))
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavigationItemActive(
  pathname: string,
  item: Pick<NavigationItem, "href" | "exact">
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
