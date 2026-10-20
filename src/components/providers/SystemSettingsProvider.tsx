"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  deriveBrandColorTokens,
  type SystemSettingsDocument,
  type SystemSettingsGroup
} from "@/config/systemSettings";

interface SystemSettingsContextValue {
  settings: SystemSettingsDocument;
  updateGroup: <TGroup extends SystemSettingsGroup>(
    group: TGroup,
    value: SystemSettingsDocument[TGroup]
  ) => void;
}

const SystemSettingsContext = createContext<SystemSettingsContextValue | null>(null);

export function SystemSettingsProvider({
  initialSettings,
  children
}: {
  initialSettings: SystemSettingsDocument;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    const tokens = deriveBrandColorTokens(settings.appearance.primaryColor);
    const root = document.documentElement;
    root.style.setProperty("--color-primary", tokens.primary);
    root.style.setProperty("--color-primary-hover", tokens.primaryHover);
    root.style.setProperty("--color-primary-active", tokens.primaryActive);
    root.style.setProperty("--color-primary-soft", tokens.primarySubtle);
    root.style.setProperty("--color-primary-border", tokens.primaryBorder);
    root.style.setProperty("--color-primary-foreground", tokens.primaryForeground);
    root.style.setProperty("--color-focus-ring", tokens.focusRing);
    root.dataset.density = settings.appearance.density;
    root.dataset.tableDensity = settings.appearance.tableDensity;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement("link");
    favicon.rel = "icon";
    favicon.href = settings.branding.faviconUrl
      ? `${settings.branding.faviconUrl}${settings.branding.faviconUrl.includes("?") ? "&" : "?"}v=${settings.branding.assetVersion}`
      : "/favicon.ico";
    if (!favicon.parentNode) document.head.appendChild(favicon);
  }, [settings.appearance, settings.branding.faviconUrl, settings.branding.assetVersion]);

  const value = useMemo<SystemSettingsContextValue>(
    () => ({
      settings,
      updateGroup: (group, groupValue) => {
        setSettings((current) => ({ ...current, [group]: groupValue }));
      }
    }),
    [settings]
  );

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
}

export function useSystemSettings(): SystemSettingsContextValue {
  const context = useContext(SystemSettingsContext);
  if (!context) throw new Error("useSystemSettings must be used inside SystemSettingsProvider");
  return context;
}

export function useBranding() {
  return useSystemSettings().settings.branding;
}

export function useAppearance() {
  return useSystemSettings().settings.appearance;
}

export function useOrganizationSettings() {
  return useSystemSettings().settings.organization;
}
