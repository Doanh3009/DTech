"use client";

import Link from "next/link";
import { Bell, ChevronRight, Grid2X2, Menu, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { useOptionalMobileNavigation } from "@/components/layout/MobileNavigationContext";
import { navigationIconMap } from "@/components/layout/icons";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Drawer } from "@/components/shared/Overlays";
import { applicationForPath, visibleApplicationShortcuts } from "@/config/moduleRegistry";
import { isMobileDestinationActive, type MobileNavDestination } from "@/config/mobileNavigationResolver";
import { isPathEnabled } from "@/config/systemSettings";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

import styles from "./ModuleNavigation.module.css";

interface MobileAppLauncherProps {
  user: AuthenticatedUser;
  variant?: "brand" | "more" | "nav";
  pathname?: string;
  navigationItems?: readonly MobileNavDestination[];
}

export function MobileAppLauncher({ user, variant = "brand", pathname: pathnameOverride, navigationItems }: MobileAppLauncherProps) {
  const { settings } = useSystemSettings();
  const currentPathname = usePathname();
  const pathname = pathnameOverride ?? currentPathname;
  const navigation = useOptionalMobileNavigation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const application = applicationForPath(pathname);
  const workspaceItems = (navigationItems ?? navigation?.override?.items)?.filter((item) =>
    !item.action && applicationForPath(item.href.split(/[?#]/)[0]).id === application.id
    && isPathEnabled(item.href.split(/[?#]/)[0], settings.modules)
    && (!item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"))
  );
  const shortcuts: readonly MobileNavDestination[] = workspaceItems?.length ? workspaceItems
    : visibleApplicationShortcuts(application, user, settings.modules, settings.navigation)
      .filter((item) => !item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"))
      .map((item) => ({ href: item.href, label: item.href === "/attendance/notifications" ? "Thông báo công" : item.mobileLabel ?? item.label, icon: item.icon }));
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, (letter) => letter === "Đ" ? "D" : "d").toLocaleLowerCase("vi");
  const query = normalize(search.trim());
  const visibleShortcuts = shortcuts.filter((item) => !query || normalize(item.label).includes(query));
  const canViewNotifications = (can(user.permissions, "notification.view") || can(user.permissions, "notification.self.view"))
    && !shortcuts.some((item) => item.href === "/notifications");
  const close = () => { setOpen(false); setSearch(""); };

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Mở điều hướng ${application.label}`}
        className={cn("mobile-app-launcher__trigger", `mobile-app-launcher__trigger--${variant}`, variant === "nav" && "mobile-bottom-nav__item", open && "is-active")}
        onClick={() => setOpen(true)}
        type="button"
      >
        {variant === "nav" ? <><span className="mobile-bottom-nav__icon"><Menu aria-hidden="true" size={22} strokeWidth={1.8} /></span><span className="mobile-bottom-nav__label">Nghiệp vụ</span></> : <Menu aria-hidden="true" size={21} strokeWidth={1.8} />}
      </button>
      <Drawer className={cn("mobile-app-sheet", styles.moduleMenu)} onClose={close} open={open} title={application.label}>
        <div className="mobile-app-sheet__body" style={{ "--current-app-accent": application.accentColor } as CSSProperties}>
          {shortcuts.length > 6 ? <label className="mobile-app-sheet__search"><Search aria-hidden="true" size={19} /><input aria-label="Tìm nghiệp vụ" autoComplete="off" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nghiệp vụ" type="search" value={search} />{search ? <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")} type="button"><X aria-hidden="true" size={17} /></button> : null}</label> : null}
          {visibleShortcuts.length ? <section className="mobile-app-sheet__section mobile-app-sheet__section--context"><nav aria-label={`Nghiệp vụ ${application.label}`} className="mobile-app-sheet__links">
            {visibleShortcuts.map((item) => {
              const Icon = navigationIconMap[item.icon];
              const active = isMobileDestinationActive(pathname, item, shortcuts);
              return <Link aria-current={active ? "page" : undefined} className={cn(active && "is-active")} href={item.href} key={item.href} onClick={close}><span className="mobile-app-sheet__link-icon"><Icon aria-hidden="true" size={20} strokeWidth={1.8} /></span><span>{item.label}</span><ChevronRight aria-hidden="true" size={16} /></Link>;
            })}
          </nav></section> : null}
          {query && !visibleShortcuts.length ? <p className="mobile-app-launcher__empty">Không tìm thấy nghiệp vụ</p> : null}
          <nav aria-label="Điều hướng chung" className={cn("mobile-app-sheet__section", "mobile-app-sheet__links", styles.moduleReturn)}>
            <Link href="/applications" onClick={close}><span className="mobile-app-sheet__link-icon"><Grid2X2 aria-hidden="true" size={20} /></span><span>Tất cả module</span><ChevronRight aria-hidden="true" size={16} /></Link>
            {canViewNotifications ? <Link href="/notifications" onClick={close}><span className="mobile-app-sheet__link-icon"><Bell aria-hidden="true" size={20} /></span><span>Thông báo</span><ChevronRight aria-hidden="true" size={16} /></Link> : null}
          </nav>
        </div>
      </Drawer>
    </>
  );
}
