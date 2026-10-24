import Link from "next/link";
import { notFound } from "next/navigation";

import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { SystemSettingsProvider } from "@/components/providers/SystemSettingsProvider";
import { defaultSystemSettings } from "@/config/systemSettings";
import { modulesForIndustry } from "@/config/erpModules";
import { allFoundationPermissions } from "@/lib/auth/permissions";
import { ModuleHub } from "@/features/workspace/ModuleHub";
import { ModulesPage } from "@/features/system-admin/pages/ModulesPage";
import { DesignDnaPage } from "@/features/system-admin/pages/DesignDnaPage";

export default async function ErpPreviewPage({ searchParams }: PageProps<"/ui-preview/erp">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const settings = structuredClone(defaultSystemSettings);
  settings.organization.shortName = "DIMIXO";
  settings.organization.companyName = "Doanh nghiệp mẫu";
  settings.branding.logoMainUrl = null;
  settings.modules = modulesForIndustry("garment");
  const user = { id: "dna-preview", displayName: "Quản trị mẫu", username: "preview", email: "preview@example.invalid", status: "active" as const, permissions: [...allFoundationPermissions] };
  return <SystemSettingsProvider initialSettings={settings}><CurrentUserProvider user={user}>
    <main className="page-main">
      <nav aria-label="Xem trước ERP" className="erp-preview-nav"><strong>Mẫu phát triển</strong><Link href="/ui-preview/erp">Module</Link><Link href="/ui-preview/erp?view=setup">Thiết lập ERP</Link><Link href="/ui-preview/erp?view=dna">Design DNA</Link></nav>
      {view === "setup" ? <ModulesPage /> : view === "dna" ? <DesignDnaPage /> : <ModuleHub />}
    </main>
  </CurrentUserProvider></SystemSettingsProvider>;
}
