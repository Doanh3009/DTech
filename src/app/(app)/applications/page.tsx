import { ModuleHub } from "@/features/workspace/ModuleHub";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";

export default function ApplicationsPage() {
  return <ModuleHub controlCenter={controlCenterEnabled()} />;
}
