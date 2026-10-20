import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { StockCountListView } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "warehouse.stock_count.view")) return <PermissionDeniedState />;
  return <div className="page-stack"><PageHeader action={can(user.permissions, "warehouse.stock_count.create") ? <Link className="button button--primary button--md" href="/warehouse/stock-counts/new"><Plus aria-hidden="true" size={16} /><span>Tạo kiểm kê</span></Link> : undefined} title="Kiểm kê" /><StockCountListView /></div>;
}
