import { DocumentTypeSettingsView, ImportExportSettingsView } from "@/features/import-export/components/ImportExportViews";
import { PageHeader } from "@/components/shared/PageHeader";

export default function Page() {
  return <div className="page-stack"><PageHeader title="Cấu hình xuất nhập khẩu" /><ImportExportSettingsView /><DocumentTypeSettingsView /></div>;
}
