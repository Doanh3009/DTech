import Link from "next/link"; import { PageHeader } from "@/components/shared/PageHeader"; import { WarehouseListView } from "@/features/warehouse";
export default function Page(){return <div className="page-stack"><PageHeader action={<Link className="button button--primary button--md" href="/warehouse/warehouses/new">Thêm kho</Link>} title="Danh sách kho"/><WarehouseListView/></div>;}
