import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PermissionDeniedState } from "@/components/shared/States";
import { ItemListView } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page(){
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "warehouse.item.view")) return <PermissionDeniedState />;
  return <div className="page-stack"><PageHeader action={can(user.permissions, "warehouse.item.manage") ? <Link className="button button--primary button--md" href="/warehouse/items/new"><Plus aria-hidden="true" size={16} /><span>Thêm hàng hóa</span></Link> : undefined} title="Hàng hóa"/><ItemListView /></div>;
}
