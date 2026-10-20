import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";import { ShipmentListView } from "@/features/import-export/components/ImportExportViews";export default function Page(){return <div className="page-stack"><PageHeader action={<Link href="/import-export/shipments/new"><Button leftIcon={<Plus aria-hidden="true" size={16}/>} variant="primary">Tạo lô hàng</Button></Link>} title="Lô hàng"/><ShipmentListView/></div>;}
