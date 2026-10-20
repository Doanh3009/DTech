import type { ReactNode } from "react";

import { ShipmentDetailView } from "@/features/import-export/components/ShipmentWorkspace";

export default async function ShipmentLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <><ShipmentDetailView id={id} key={id} />{children}</>;
}
