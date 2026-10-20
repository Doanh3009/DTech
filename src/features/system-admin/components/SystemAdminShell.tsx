"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  Building2,
  ClipboardCheck,
  Compass,
  History,
  Languages,
  LayoutDashboard,
  Paintbrush,
  Palette,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { can, type Permission } from "@/lib/auth/permissions";

interface AdminRoute {
  href: string;
  label: string;
  permission: Permission;
  icon: LucideIcon;
}

const adminRoutes: readonly AdminRoute[] = [
  { href: "/system-admin/branding", label: "Thương hiệu", permission: "branding.view", icon: Paintbrush },
  { href: "/system-admin/appearance", label: "Giao diện", permission: "appearance.view", icon: Palette },
  { href: "/system-admin/navigation", label: "Điều hướng", permission: "navigation.manage", icon: Compass },
  { href: "/system-admin/dashboard", label: "Bố cục Dashboard", permission: "navigation.manage", icon: LayoutDashboard },
  { href: "/system-admin/modules", label: "Phân hệ", permission: "module.manage", icon: Boxes },
  { href: "/system-admin/organization", label: "Tổ chức", permission: "organization_settings.view", icon: Building2 },
  { href: "/system-admin/payslip-template", label: "Mẫu phiếu lương", permission: "module.manage", icon: ReceiptText },
  { href: "/system-admin/attendance-checklist", label: "Checklist điểm danh", permission: "system_admin.access", icon: ClipboardCheck },
  { href: "/system-admin/localization", label: "Định dạng & thời gian", permission: "localization.manage", icon: Languages },
  { href: "/system-admin/security", label: "Bảo mật", permission: "system_admin.access", icon: ShieldCheck },
  { href: "/system-admin/operations", label: "Vận hành", permission: "operations.view", icon: Activity },
  { href: "/system-admin/config-history", label: "Lịch sử cấu hình", permission: "config_history.view", icon: History },
  { href: "/system-admin/audit", label: "Nhật ký hệ thống", permission: "audit.view", icon: ScrollText }
];

export function SystemAdminShell({ children, permissions }: { children: ReactNode; permissions: readonly Permission[] }) {
  const pathname = usePathname();

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (href === pathname || document.body.dataset.systemAdminDirty !== "true") return;
    if (!window.confirm("Bạn có thay đổi chưa lưu. Rời trang?")) event.preventDefault();
  }

  return (
    <div className="system-admin-shell">
      <aside className="system-admin-subnav" aria-label="Trung tâm quản trị">
        <div className="system-admin-subnav__title">TRUNG TÂM QUẢN TRỊ</div>
        <nav>
          {adminRoutes.filter((route) => can(permissions, route.permission)).map((route) => {
            const Icon = route.icon;
            return (
              <Link
                className={cn(pathname === route.href && "is-active")}
                href={route.href}
                key={route.href}
                onClick={(event) => handleNavigate(event, route.href)}
              >
                <Icon aria-hidden="true" size={17} />
                <span>{route.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="system-admin-content">{children}</div>
    </div>
  );
}
