import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { ProjectList } from "@/features/projects/components/ProjectList";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  const canCreate = user ? can(user.permissions, "project.create") : false;
  return <div className="page-stack project-portfolio-page"><PageHeader action={canCreate ? <Link className="button button--primary button--md" href="/projects/new"><Plus aria-hidden="true" size={17} />Tạo gói</Link> : undefined} title="Gói / Công trường" /><ProjectList canCreate={canCreate} /></div>;
}
