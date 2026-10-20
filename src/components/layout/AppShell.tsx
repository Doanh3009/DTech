"use client";

import type {} from "react/canary";
import { ViewTransition, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { AppHeader, isMobileHeaderRootScreen } from "@/components/layout/AppHeader";
import { AppRail } from "@/components/layout/AppRail";
import { MobileNavigationProvider } from "@/components/layout/MobileNavigationContext";
import { BackLink } from "@/components/shared/BackLink";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { isPathEnabled } from "@/config/systemSettings";
import { SystemNoticeBanner } from "@/features/shared-platforms/components/SystemNoticeBanner";
import { resolveLandingPage } from "@/features/dashboard/registry";
import { getBackHref } from "@/config/routeRegistry";
import { RealtimeProvider, useRealtimeConnectionState } from "@/components/providers/RealtimeProvider";
import { can } from "@/lib/auth/permissions";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { visibleApplications } from "@/config/moduleRegistry";
import { installBackHistory } from "@/lib/navigation/backHistory";
import { readWorkspacePreferences, type WorkspacePreferences } from "@/lib/ui/workspacePreferencesRequest";
import { animatePageEntry, supportsPageViewTransitions } from "@/lib/ui/pageEntryMotion";

const INACTIVITY_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const ChatDockLauncher = dynamic(() => import("@/features/messaging/ChatDockLauncher").then((module) => module.ChatDockLauncher), { ssr: false });

/** This boundary adds no DOM and never keys or remounts the current page. */
function WorkspacePageMotion({ children, instant = false }: { children: ReactNode; instant?: boolean }) {
  // Next's App Router supplies React canary. Keep plain React consumers usable.
  if (!ViewTransition) return children;
  return <ViewTransition default="none" name="workspace-content" update={instant ? "none" : "workspace-page-motion"}>{children}</ViewTransition>;
}

function AppShellContent({ children, user, testEnvironment }: { children: ReactNode; user: AuthenticatedUser; testEnvironment?: string }) {
  const pathname = usePathname();
  const isShipmentWorkspace = /^\/import-export\/shipments\/[^/]+\/(overview|lines|containers|documents|customs|receiving|history)$/.test(pathname);
  const router = useRouter();
  useLayoutEffect(() => installBackHistory(user.id), [user.id]);
  const { settings } = useSystemSettings();
  const [collapsed, setCollapsed] = useState(false);
  const railPreferenceKey = `ct:sidebar-layout:v2:${user.id}`;
  const [localBackHref, setLocalBackHref] = useState<string>();
  const [pageTitles, setPageTitles] = useState<{ pathname: string; pageTitle?: string; documentTitle?: string }>();
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const main = mainRef.current;
    // Native snapshots animate both screens after React commits navigation;
    // running an entry animation too would produce two competing movements.
    if (!main || isShipmentWorkspace || supportsPageViewTransitions()) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animation = animatePageEntry(main, reduced.matches);
    const stop = () => { if (reduced.matches) animation?.cancel(); };
    reduced.addEventListener("change", stop);
    return () => { animation?.cancel(); reduced.removeEventListener("change", stop); };
  }, [pathname, isShipmentWorkspace]);
  const preferencesRef = useRef<WorkspacePreferences | undefined>(undefined);
  const connectionState = useRealtimeConnectionState();
  const isPackageRoute = /^\/projects\/[^/]+\/(?:today|progress|team|profile|documents|updates)$/.test(pathname);
  // The shared shell owns the fallback return control. A locally-declared
  // BackLink (for a wizard or a record with a specific parent) wins, so users
  // never see two competing return actions.
  const backHref = isPackageRoute ? "/projects" : getBackHref(pathname);
  const hasChatAccess = can(user.permissions, "chat.access");
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const contentClassName = [
    "app-content",
    hasChatAccess && "app-content--chat",
    isDashboardRoute && "app-content--dashboard",
    isPackageRoute && "app-content--package",
    /^\/messages\/[^/]+/.test(pathname) && "app-content--conversation",
    (pathname === "/personal" || pathname === "/applications") && "app-content--mobile-home",
    pathname === "/attendance/quick" && "app-content--capture"
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;
    const phone = window.matchMedia("(max-width: 767px)");
    let fullHeight = viewport.height;
    let frame = 0;
    const updateViewport = () => {
      const active = document.activeElement;
      const editing = active instanceof HTMLTextAreaElement
        || active instanceof HTMLInputElement && !active.readOnly && ["text", "search", "email", "password", "url", "tel", "number"].includes(active.type)
        || active instanceof HTMLElement && active.isContentEditable;
      if (!editing) fullHeight = Math.max(fullHeight, viewport.height);
      const keyboardOpen = phone.matches && editing && viewport.scale === 1
        && Math.max(fullHeight - viewport.height, window.innerHeight - viewport.height) > 120;
      shell.dataset.keyboardOpen = String(keyboardOpen);
      shell.style.setProperty("--app-viewport-height", `${viewport.height}px`);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateViewport);
    };
    const resetViewport = () => { fullHeight = viewport.height; scheduleUpdate(); };
    updateViewport();
    viewport.addEventListener("resize", scheduleUpdate);
    viewport.addEventListener("scroll", scheduleUpdate);
    document.addEventListener("focusin", scheduleUpdate);
    document.addEventListener("focusout", scheduleUpdate);
    window.addEventListener("orientationchange", resetViewport);
    phone.addEventListener("change", resetViewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", scheduleUpdate);
      viewport.removeEventListener("scroll", scheduleUpdate);
      document.removeEventListener("focusin", scheduleUpdate);
      document.removeEventListener("focusout", scheduleUpdate);
      window.removeEventListener("orientationchange", resetViewport);
      phone.removeEventListener("change", resetViewport);
    };
  }, []);

  useEffect(() => {
    if (!isPathEnabled(pathname, settings.modules)) {
      const contextualLanding = resolveLandingPage(user, settings.dashboard);
      const enabledLanding = visibleApplications(user, settings.modules)[0]?.defaultRoute ?? "/profile";
      router.replace(isPathEnabled(contextualLanding, settings.modules) ? contextualLanding : enabledLanding);
    }
  }, [pathname, router, settings.dashboard, settings.modules, user]);

  useEffect(() => {
    let active = true;
    const restoreRail = () => {
      if (!active) return;
      try { setCollapsed(window.localStorage.getItem(railPreferenceKey) === "compact"); }
      catch { /* Keep navigation labels visible when storage is unavailable. */ }
    };
    queueMicrotask(restoreRail);
    void readWorkspacePreferences().then((preferences) => {
      if (!active || !preferences) return;
      preferencesRef.current = preferences;
      document.documentElement.dataset.density = preferences.density === "default" ? "standard" : preferences.density;
    }).catch(() => undefined);
    const update = (event: Event) => {
      const preferences = (event as CustomEvent<{ sidebarCollapsed?: boolean; density?: string }>).detail;
      if (typeof preferences?.sidebarCollapsed === "boolean") {
        setCollapsed(preferences.sidebarCollapsed);
        try { window.localStorage.setItem(railPreferenceKey, preferences.sidebarCollapsed ? "compact" : "expanded"); }
        catch { /* The in-memory choice remains usable. */ }
      }
    };
    window.addEventListener("ui-preferences-updated", update);
    return () => { active = false; window.removeEventListener("ui-preferences-updated", update); };
  }, [railPreferenceKey]);

  const changeSidebarState = useCallback((nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    try { window.localStorage.setItem(railPreferenceKey, nextCollapsed ? "compact" : "expanded"); }
    catch { /* The existing server preference still persists the choice. */ }
    const persist = async () => {
      let current = preferencesRef.current;
      if (!current) {
        current = await readWorkspacePreferences();
      }
      if (!current) return;
      const next = { ...current, sidebarCollapsed: nextCollapsed };
      preferencesRef.current = next;
      setCollapsed(nextCollapsed);
      window.dispatchEvent(new CustomEvent("ui-preferences-updated", { detail: next }));
      await fetch("/api/v1/workspace/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next)
      });
    };
    void persist().catch(() => undefined);
  }, [railPreferenceKey]);

  useEffect(() => {
    const activityKey = `ct:last-activity:${user.id}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastStoredAt = 0;
    let expiring = false;
    const expire = async () => {
      if (expiring) return;
      expiring = true;
      try { await fetch("/api/v1/auth/logout", { method: "POST" }); }
      finally {
        window.localStorage.removeItem(activityKey);
        router.replace("/login?reason=session-expired");
        router.refresh();
      }
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      const stored = Number(window.localStorage.getItem(activityKey));
      const lastActivity = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) { void expire(); return; }
      timer = setTimeout(() => void expire(), remaining);
    };
    const markActivity = () => {
      const now = Date.now();
      if (now - lastStoredAt < 60_000) return;
      lastStoredAt = now;
      window.localStorage.setItem(activityKey, String(now));
      schedule();
    };
    window.localStorage.setItem(activityKey, String(Date.now()));
    for (const eventName of ["pointerdown", "keydown", "touchstart"] as const) window.addEventListener(eventName, markActivity, { passive: true });
    window.addEventListener("storage", schedule);
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      for (const eventName of ["pointerdown", "keydown", "touchstart"] as const) window.removeEventListener(eventName, markActivity);
      window.removeEventListener("storage", schedule);
    };
  }, [pathname, router, user.id]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const findLocalBackLink = () => {
      const link = main.querySelector<HTMLAnchorElement>(":scope > :not(.page-context-navigation) [data-ui='back-control'], :scope > :not(.page-context-navigation) .back-link");
      setLocalBackHref(link?.getAttribute("href") ?? undefined);
      const pageHeader = main.querySelector<HTMLElement>('.page-header[data-ui="page-header"]');
      const pageTitle = pageHeader?.querySelector("h1")?.textContent?.trim() || undefined;
      const documentTitle = main.querySelector("h1")?.textContent?.trim() || undefined;
      setPageTitles((current) => current?.pathname === pathname && current.pageTitle === pageTitle && current.documentTitle === documentTitle ? current : { pathname, pageTitle, documentTitle });
    };
    findLocalBackLink();
    const observer = new MutationObserver(findLocalBackLink);
    observer.observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href"] });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className="app-shell" ref={shellRef}>
      <a className="app-shell__skip-link" href="#main-content">Đến nội dung chính</a>
      <AppRail
        collapsed={collapsed}
        onCollapsedChange={changeSidebarState}
        pathname={pathname}
        user={user}
      />
      <div className={contentClassName} data-mobile-title-in-bar={Boolean(pageTitles?.pathname === pathname && pageTitles.pageTitle && !isMobileHeaderRootScreen(pathname))}>
        <AppHeader backHrefOverride={localBackHref} connectionState={connectionState} documentTitleOverride={pageTitles?.pathname === pathname ? pageTitles.documentTitle : undefined} homeHref={resolveLandingPage(user, settings.dashboard)} onSidebarToggle={() => changeSidebarState(!collapsed)} pageTitleOverride={pageTitles?.pathname === pathname ? pageTitles.pageTitle : undefined} pathname={pathname} sidebarCollapsed={collapsed} testEnvironment={testEnvironment} user={user} />
        <SystemNoticeBanner />
        <WorkspacePageMotion instant={isShipmentWorkspace}><main className="page-main" id="main-content" ref={mainRef} tabIndex={-1}>
          {backHref && !localBackHref ? <nav aria-label="Điều hướng quay lại" className="page-context-navigation"><BackLink href={backHref} label={backHref === "/projects" ? "Danh sách gói" : "Trở lại"} /></nav> : null}
          {children}
        </main></WorkspacePageMotion>
        {hasChatAccess ? <ChatDockLauncher /> : null}
      </div>
    </div>
  );
}

export function AppShell({ children, user, testEnvironment }: { children: ReactNode; user: AuthenticatedUser; testEnvironment?: string }) {
  return (
    <CurrentUserProvider user={user}>
      <RealtimeProvider accountId={user.id}><MobileNavigationProvider><AppShellContent user={user} testEnvironment={testEnvironment}>{children}</AppShellContent></MobileNavigationProvider></RealtimeProvider>
    </CurrentUserProvider>
  );
}
