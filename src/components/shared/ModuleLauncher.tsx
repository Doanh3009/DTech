"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { navigationIconMap, navigationIconSizes } from "@/components/layout/icons";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { visibleApplications, type ApplicationDefinition } from "@/config/moduleRegistry";
import { readWorkspacePreferences } from "@/lib/ui/workspacePreferencesRequest";
import { LinkLoadingIndicator } from "@/components/shared/LinkLoadingIndicator";

const mobileLabels: Partial<Record<ApplicationDefinition["id"], string>> = { projects: "Công trường", operations: "Đơn từ" };

export function ModuleIconCard({ application }: { application: ApplicationDefinition }) {
  const Icon = navigationIconMap[application.icon];
  const style = {
    "--module-accent": application.accentColor,
    "--module-surface": application.accentSoft
  } as CSSProperties;

  return (
    <Link className="module-icon-card" href={application.defaultRoute} style={style}>
      <span className="module-icon-card__icon"><Icon aria-hidden="true" size={navigationIconSizes.module} strokeWidth={1.9} /></span>
      <strong>{mobileLabels[application.id] ? <><span className="module-icon-card__label-desktop">{application.label}</span><span className="module-icon-card__label-mobile">{mobileLabels[application.id]}</span></> : application.label}</strong>
      <ArrowRight aria-hidden="true" className="module-icon-card__arrow" size={navigationIconSizes.launcherArrow} />
      <LinkLoadingIndicator />
    </Link>
  );
}

export function ModuleLauncher({ showHeading = true, excludePersonal = false }: { showHeading?: boolean; excludePersonal?: boolean } = {}) {
  const user = useCurrentUser();
  const { settings } = useSystemSettings();
  const [pinned, setPinned] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void readWorkspacePreferences().then((preferences) => {
      if (active && preferences) setPinned(preferences.pinnedModules);
    }).catch(() => undefined);
    const update = (event: Event) => {
      const preferences = (event as CustomEvent<{ pinnedModules?: string[] }>).detail;
      if (Array.isArray(preferences?.pinnedModules)) setPinned(preferences.pinnedModules);
    };
    window.addEventListener("ui-preferences-updated", update);
    return () => { active = false; window.removeEventListener("ui-preferences-updated", update); };
  }, []);
  const applications = visibleApplications(user, settings.modules).filter((application) => application.id !== "overview" && (!excludePersonal || application.id !== "attendance")).sort((first, second) => {
    const firstIndex = pinned.indexOf(first.id), secondIndex = pinned.indexOf(second.id);
    if (firstIndex >= 0 && secondIndex >= 0) return firstIndex - secondIndex;
    if (firstIndex >= 0) return -1;
    if (secondIndex >= 0) return 1;
    return 0;
  });
  if (!applications.length) return null;

  return (
    <section aria-label={showHeading ? undefined : "Ứng dụng được phép sử dụng"} aria-labelledby={showHeading ? "my-modules-title" : undefined} className="module-launcher">
      {showHeading ? <header className="dashboard-section-heading"><h2 id="my-modules-title">Ứng dụng của tôi</h2></header> : null}
      <div className="module-launcher__grid">
        {applications.map((application) => <ModuleIconCard application={application} key={application.id} />)}
      </div>
    </section>
  );
}
