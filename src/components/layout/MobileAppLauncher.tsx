"use client";

import Link from "next/link";
import { Bell, Check, ChevronRight, Grid2X2, Menu, MessageCircle, Search, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { useOptionalMobileNavigation } from "@/components/layout/MobileNavigationContext";
import { navigationIconMap, navigationIconSizes } from "@/components/layout/icons";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Drawer } from "@/components/shared/Overlays";
import { applicationForPath, visibleApplications, visibleApplicationShortcuts } from "@/config/moduleRegistry";
import { isMobileDestinationActive, isMobilePersonalRoute, mobileApplicationDestination, type MobileNavDestination } from "@/config/mobileNavigationResolver";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

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
  const applications = visibleApplications(user, settings.modules).filter((application) => mobileApplicationDestination(application, user) !== undefined);
  const currentApplication = applicationForPath(pathname);
  const personal = isMobilePersonalRoute(pathname, user) && !pathname.startsWith("/worker-attendance");
  const contextApplication = personal ? applications.find((application) => application.id === "attendance") : applications.find((application) => application.id === currentApplication.id);
  const workspaceItems = (navigationItems ?? navigation?.override?.items)?.filter((item) => !item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"));
  const shortcuts: readonly MobileNavDestination[] = workspaceItems?.length ? workspaceItems
    : contextApplication ? visibleApplicationShortcuts(contextApplication, user, settings.modules, settings.navigation)
      .filter((item) => !item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"))
      .map((item) => ({ href: item.href, label: item.href === "/attendance/notifications" ? "Thông báo công" : item.mobileLabel ?? item.label, icon: item.icon })) : [];
  const contextLabel = workspaceItems?.length ? "Công trường đang mở" : contextApplication?.label;
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, (letter) => letter === "Đ" ? "D" : "d").toLocaleLowerCase("vi");
  const query = normalize(search.trim());
  const matches = (value: string) => !query || normalize(value).includes(query);
  const visibleApps = applications.filter((application) => matches(application.id === "overview" ? "Tổng quan" : application.id === "projects" ? "Công trường" : application.label));
  const visibleShortcuts = shortcuts.filter((item) => matches(item.label));
  const visibleUtilities = [
    matches("Tìm kiếm"),
    !applications.some((application) => application.id === "attendance") && matches("Cá nhân"),
    can(user.permissions, "chat.access") && matches("Tin nhắn"),
    !shortcuts.some((item) => item.href === "/notifications") && matches("Thông báo"),
    can(user.permissions, "profile.view") && matches("Tài khoản")
  ].some(Boolean);
  const close = () => { setOpen(false); setSearch(""); };

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Mở Ứng dụng của tôi"
        className={cn("mobile-app-launcher__trigger", `mobile-app-launcher__trigger--${variant}`, variant === "nav" && "mobile-bottom-nav__item", variant === "nav" && (open || pathname === "/applications") && "is-active")}
        onClick={() => setOpen(true)}
        type="button"
      >
        {variant === "nav" ? <><span className="mobile-bottom-nav__icon"><Grid2X2 aria-hidden="true" size={22} strokeWidth={1.8} /></span><span className="mobile-bottom-nav__label">Ứng dụng</span></> : variant === "brand" ? <Grid2X2 aria-hidden="true" size={21} strokeWidth={1.8} /> : <Menu aria-hidden="true" size={21} strokeWidth={1.8} />}
      </button>
      <Drawer className="mobile-app-sheet" onClose={close} open={open} title="Ứng dụng của tôi">
        <div className="mobile-app-sheet__body">
        <label className="mobile-app-sheet__search"><Search aria-hidden="true" size={19} /><input aria-label="Tìm ứng dụng" autoComplete="off" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm ứng dụng" type="search" value={search} />{search ? <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")} type="button"><X aria-hidden="true" size={17} /></button> : null}</label>
        {visibleApps.length ? <nav aria-label="Ứng dụng được phép sử dụng" className="mobile-app-launcher__list mobile-app-sheet__grid">
          {visibleApps.map((application) => {
            const Icon = navigationIconMap[application.icon];
            const active = personal ? application.id === "attendance" : currentApplication.id === application.id;
            const href = application.id === "attendance" ? "/personal"
              : mobileApplicationDestination(application, user) ?? application.defaultRoute;
            const style = {
              "--module-accent": application.accentColor,
              "--module-surface": application.accentSoft
            } as CSSProperties;
            return (
              <Link aria-current={active ? "page" : undefined} className={cn(active && "is-active")} href={href} key={application.id} onClick={close} style={style} title={application.label}>
                <span className="mobile-app-sheet__app-icon"><Icon aria-hidden="true" size={navigationIconSizes.rail} strokeWidth={1.8} />{active ? <Check aria-hidden="true" className="mobile-app-sheet__selected" size={12} strokeWidth={3} /> : null}</span>
                <strong>{application.id === "overview" ? "Tổng quan" : application.id === "projects" ? "Công trường" : application.id === "operations" ? "Điều hành" : application.label}</strong>
              </Link>
            );
          })}
        </nav> : null}
        {visibleShortcuts.length ? <section className="mobile-app-sheet__section mobile-app-sheet__section--context"><h3>{contextLabel}</h3><nav aria-label={contextLabel ?? "Điều hướng ứng dụng"} className="mobile-app-sheet__links">
          {visibleShortcuts.map((item) => {
            const Icon = navigationIconMap[item.icon];
            const active = isMobileDestinationActive(pathname, item, shortcuts);
            return <Link aria-current={active ? "page" : undefined} className={cn(active && "is-active")} href={item.href} key={item.href} onClick={close}><span className="mobile-app-sheet__link-icon"><Icon aria-hidden="true" size={20} strokeWidth={1.8} /></span><span>{item.label}</span><ChevronRight aria-hidden="true" size={16} /></Link>;
          })}
        </nav></section> : null}
        {visibleUtilities ? <section className="mobile-app-sheet__section"><h3>Tiện ích</h3><nav aria-label="Tiện ích cá nhân" className="mobile-app-sheet__links">
          {matches("Tìm kiếm") ? <Link href="/search" onClick={close}><span className="mobile-app-sheet__link-icon"><Search aria-hidden="true" size={20} /></span><span>Tìm kiếm</span><ChevronRight aria-hidden="true" size={16} /></Link> : null}
          {!applications.some((application) => application.id === "attendance") && matches("Cá nhân") ? <Link href="/personal" onClick={close}><span className="mobile-app-sheet__link-icon"><UserRound aria-hidden="true" size={20} /></span><span>Cá nhân</span><ChevronRight aria-hidden="true" size={17} /></Link> : null}
          {can(user.permissions, "chat.access") && matches("Tin nhắn") ? <Link href="/messages" onClick={close}><span className="mobile-app-sheet__link-icon"><MessageCircle aria-hidden="true" size={20} /></span><span>Tin nhắn</span><ChevronRight aria-hidden="true" size={17} /></Link> : null}
          {!shortcuts.some((item) => item.href === "/notifications") && matches("Thông báo") ? <Link href="/notifications" onClick={close}><span className="mobile-app-sheet__link-icon"><Bell aria-hidden="true" size={20} /></span><span>Thông báo</span><ChevronRight aria-hidden="true" size={17} /></Link> : null}
          {can(user.permissions, "profile.view") && matches("Tài khoản") ? <Link href="/profile" onClick={close}><span className="mobile-app-sheet__link-icon"><UserRound aria-hidden="true" size={20} /></span><span>Tài khoản</span><ChevronRight aria-hidden="true" size={17} /></Link> : null}
        </nav></section>
          : null}
        {query && !visibleApps.length && !visibleShortcuts.length && !visibleUtilities ? <p className="mobile-app-launcher__empty">Không tìm thấy kết quả</p> : null}
        </div>
      </Drawer>
    </>
  );
}
