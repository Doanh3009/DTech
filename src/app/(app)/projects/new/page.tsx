import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { ProjectCreateForm } from "@/features/projects/components/ProjectCreateForm";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "project.create")) return <PermissionDeniedState />;
  return <div className="page-stack project-create-page"><div className="project-create-heading"><PageHeader title="Tạo gói" /></div><ProjectCreateForm /></div>;
}
