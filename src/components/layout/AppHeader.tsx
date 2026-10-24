"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { getBackHref, getRouteMeta } from "@/config/routeRegistry";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { UserMenu } from "@/components/shared/UserMenu";
import { MobileAppLauncher } from "@/components/layout/MobileAppLauncher";
import { useBranding, useOrganizationSettings, useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { applicationForPath, visibleApplications } from "@/config/moduleRegistry";
import { NotificationBell } from "@/features/shared-platforms/components/NotificationBell";
import { MessageBell } from "@/features/messaging/MessageBell";
import { CommandPalette } from "@/features/search/components/CommandPalette";
import type { RealtimeConnectionState } from "@/lib/realtime/coordinator";
import { can } from "@/lib/auth/permissions";
import { BackLink } from "@/components/shared/BackLink";
import { AppLogo } from "@/components/layout/AppLogo";
import { IconButton } from "@/components/shared/Button";
import { HeaderTestControl } from "@/features/testing/HeaderTestControl";

export interface AppHeaderProps {
  pathname: string;
  user: AuthenticatedUser;
  connectionState: RealtimeConnectionState;
  backHrefOverride?: string | null;
  pageTitleOverride?: string;
  documentTitleOverride?: string;
  homeHref?: string;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  testEnvironment?: string;
}

const connectionLabels: Record<RealtimeConnectionState, string> = {
  connected: "",
  connecting: "",
  reconnecting: "Đang thử kết nối lại…",
  degraded: "Kết nối realtime không ổn định",
  offline: "Mất kết nối"
};

export function isMobileHeaderRootScreen(pathname: string) {
  return pathname === "/applications";
}

export function AppHeader({ pathname, user, connectionState, backHrefOverride, pageTitleOverride, documentTitleOverride, homeHref = "/applications", sidebarCollapsed = false, onSidebarToggle, testEnvironment }: AppHeaderProps) {
  const branding = useBranding();
  const organization = useOrganizationSettings();
  const { settings } = useSystemSettings();
  const isModuleHub = pathname === "/applications";
  const application = applicationForPath(pathname);
  const moduleHome = visibleApplications(user, settings.modules).find((item) => item.id === application.id)?.defaultRoute ?? application.defaultRoute;
  const routeMeta = getRouteMeta(pathname);
  const meta = /^\/projects\/[^/]+\/(?:today|progress|team|profile|documents)$/.test(pathname)
    ? { ...routeMeta, title: routeMeta.title.split(" · ").at(-1) ?? routeMeta.title }
    : routeMeta;
  const isRootScreen = isMobileHeaderRootScreen(pathname);
  const backHref = isModuleHub ? null : backHrefOverride ?? getBackHref(pathname) ?? "/applications";
  const parentTitle = getRouteMeta(pathname.slice(0, pathname.lastIndexOf("/"))).title;
  const routeTitle = meta.title === "Không tìm thấy" ? parentTitle === "Không tìm thấy" ? "Ứng dụng" : parentTitle : meta.title;
  const mobileTitle = pageTitleOverride ?? routeTitle;

  useEffect(() => {
    const title = `${documentTitleOverride ?? pageTitleOverride ?? routeTitle} | ${branding.systemName}`;
    const updateTitle = () => { if (document.title !== title) document.title = title; };
    updateTitle();
    const observer = new MutationObserver(updateTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [branding.systemName, documentTitleOverride, pageTitleOverride, routeTitle]);

  return (
    <header className={`app-header app-header--compact ${isRootScreen ? "app-header--root" : "app-header--detail"}`}>
      <div className="app-header__desktop-leading">
        {onSidebarToggle ? <IconButton aria-controls="desktop-navigation" aria-expanded={!sidebarCollapsed} className="app-header__nav-toggle" label={sidebarCollapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"} onClick={onSidebarToggle}>
          {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" size={18} /> : <PanelLeftClose aria-hidden="true" size={18} />}
        </IconButton> : null}
        <nav aria-label="Vị trí hiện tại" className="app-header__context">
          {isModuleHub ? <span aria-current="page">Không gian làm việc</span> : mobileTitle === application.label ? <span aria-current="page">{application.label}</span> : <><Link href={moduleHome}>{application.label}</Link><ChevronRight aria-hidden="true" size={13} /><span aria-current="page" title={mobileTitle}>{mobileTitle}</span></>}
        </nav>
      </div>
      <div className="app-header__mobile-leading">
        {isModuleHub ? <>
          <span className="app-header__mobile-logo"><AppLogo compact href={homeHref} label="Không gian làm việc" /></span>
          <span className="app-header__mobile-brand">{organization.shortName}</span>
        </> : <>
          {backHref ? (
            <BackLink
              className="app-header__mobile-back"
              href={backHref}
              iconOnly
              label={backHref === "/applications" ? "Tất cả module" : "Quay lại"}
            />
          ) : null}
          <div className="app-header__mobile-page-copy">
            <strong className="app-header__mobile-title">{mobileTitle}</strong>
          </div>
        </>}
      </div>
      <div className="app-header__search"><CommandPalette key={pathname} user={user} /></div>
      <div className="app-header__actions">
        {testEnvironment ? <HeaderTestControl currentUsername={user.username} environment={testEnvironment} key={pathname} /> : null}
        {!isModuleHub ? <div className="app-header__mobile-menu"><MobileAppLauncher key={pathname} user={user} variant="more" /></div> : null}
        {connectionLabels[connectionState] ? (
          <span aria-label={connectionLabels[connectionState]} className={`connection-status is-${connectionState}`} title={connectionLabels[connectionState]}>
            <i aria-hidden="true" /><span>{connectionLabels[connectionState]}</span>
          </span>
        ) : null}
        {settings.modules.messaging !== false && can(user.permissions, "chat.access") ? <MessageBell /> : null}
        <NotificationBell accountId={user.id} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
