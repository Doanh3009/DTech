"use client";

import { LayoutGrid } from "lucide-react";
import { useState } from "react";

import { AppLogo } from "@/components/layout/AppLogo";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { Button } from "@/components/shared/Button";
import { ErpModuleCard } from "@/components/shared/ErpModuleCard";
import { SearchInput } from "@/components/shared/FormControls";
import { EmptyState } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getIndustryPreset } from "@/config/erpModules";
import { visibleApplications, type ApplicationDefinition } from "@/config/moduleRegistry";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import styles from "./ModuleHub.module.css";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");

export function filterHubApplications(applications: ApplicationDefinition[], query: string): ApplicationDefinition[] {
  return applications.filter((application) => normalize(application.label).includes(normalize(query.trim())));
}

export function ModuleHub({controlCenter=false}:{controlCenter?:boolean}={}) {
  const user = useCurrentUser();
  const { settings } = useSystemSettings();
  const [query, setQuery] = useState("");
  const applications = visibleApplications(user, settings.modules);
  const displayed = filterHubApplications(applications, query);
  const industry = getIndustryPreset(settings.modules.industryPreset);
  const initials = user.displayName.trim().split(/\s+/).slice(-2).map((word) => word[0]).join("").toLocaleUpperCase("vi");

  return <div className={styles.workspace} data-operator-mode={controlCenter||undefined}><AmbientBackground/>
    <header className={styles.hero} data-ui="page-header">
      <div className={styles.heroContent}>
        <span className={styles.productLabel}><LayoutGrid aria-hidden="true" size={16} />{settings.branding.systemName}</span>
        <h1>Không gian làm việc</h1>
        <div className={styles.identity}><span aria-hidden="true" className={styles.avatar}>{initials}</span><span>{user.displayName}</span></div>
      </div>
      <div className={styles.company}>
        <div className={styles.companyBrand}><AppLogo compact href="/applications" label="Không gian làm việc" /><strong>{settings.organization.shortName}</strong></div>
        <span className={styles.companyName}>{settings.organization.companyName}</span>
        <StatusBadge tone="info">{industry.label}</StatusBadge>
      </div>
    </header>
    <section aria-labelledby="module-hub-title" className={styles.section}>
      <div className={styles.sectionHeading}><div className={styles.sectionTitle}><span aria-hidden="true" className={styles.sectionMark} /><h2 id="module-hub-title">Module của bạn</h2></div><span aria-live="polite" aria-atomic="true" className={styles.count}>{displayed.length} module</span></div>
      <div className={styles.toolbar}>
        <SearchInput label="Tìm module" mobilePlaceholder="Tìm module..." onChange={(event) => setQuery(event.target.value)} placeholder="Tìm module..." value={query} />
      </div>
      {displayed.length ? <div className={styles.grid}>{displayed.map((application) => <ErpModuleCard application={application} key={application.id} />)}</div> : <EmptyState title={applications.length ? "Không tìm thấy module" : "Chưa có module được cấp quyền"} action={applications.length ? <Button onClick={() => setQuery("")}>Xóa tìm kiếm</Button> : undefined} />}
    </section>

  </div>;
}
