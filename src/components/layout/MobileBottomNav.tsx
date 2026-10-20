"use client";

import Link from "next/link";

import { navigationIconMap } from "@/components/layout/icons";
import { MobileAppLauncher } from "@/components/layout/MobileAppLauncher";
import { useMobileNavigation } from "@/components/layout/MobileNavigationContext";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { activeMobileDestination, isMobileDestinationActive, resolveMobileNavigation } from "@/config/mobileNavigationResolver";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

export function MobileBottomNav({ pathname, user }: { pathname: string; user: AuthenticatedUser }) {
  const { settings } = useSystemSettings();
  const { override } = useMobileNavigation();
  const resolvedModel = resolveMobileNavigation(pathname, user, settings);
  const localItems = override?.items.filter((item) => !item.href.startsWith("/worker-attendance") || can(user.permissions, "worker_attendance.view"));
  const contextItems = localItems?.slice(0, 4);
  const localActive = localItems?.find((item) => isMobileDestinationActive(pathname, item, localItems));
  if (contextItems && localActive && !contextItems.includes(localActive)) contextItems[contextItems.length - 1] = localActive;
  const model = contextItems?.length ? {
    ...resolvedModel,
    label: "Điều hướng trong công trường",
    direct: [...contextItems, { href: "/applications", label: "Ứng dụng", icon: "Grid2X2" as const, action: "applications" as const }].map((item, index) => ({ ...item, slot: index + 1 }))
  } : resolvedModel;
  const activeDestination = activeMobileDestination(pathname, model);

  return <nav aria-label={model.label} className="mobile-bottom-nav" data-count={model.direct.length} data-mode={model.mode}>
    {model.direct.map((item) => {
      if (item.action === "applications") return <MobileAppLauncher key={item.href} navigationItems={localItems} pathname={pathname} user={user} variant="nav" />;
      const Icon = navigationIconMap[item.icon];
      const active = item.href === activeDestination?.href;
      return <Link aria-current={active ? "page" : undefined} className={cn("mobile-bottom-nav__item", active && "is-active", item.quick && "mobile-bottom-nav__item--quick")} data-slot={item.slot} href={item.href} key={item.href}>
        <span className="mobile-bottom-nav__icon"><Icon aria-hidden="true" size={item.quick ? 24 : 21} strokeWidth={1.8} /></span>
        <span className="mobile-bottom-nav__label">{item.label}</span>
      </Link>;
    })}
  </nav>;
}
