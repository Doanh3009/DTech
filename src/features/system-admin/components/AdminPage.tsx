import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";

export function AdminPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page-stack admin-page">
      <PageHeader action={actions} title={title} />
      {children}
    </div>
  );
}
