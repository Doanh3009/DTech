import { ModuleLauncher } from "@/components/shared/ModuleLauncher";
import { PageHeader } from "@/components/shared/PageHeader";

export default function ApplicationsPage() {
  return <div className="applications-page page-stack"><PageHeader title="Ứng dụng" /><ModuleLauncher excludePersonal showHeading={false} /></div>;
}
