import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { PageHeader } from "@/components/shared/PageHeader";import { ContractListView } from "@/features/import-export/components/ImportExportViews";export default function Page(){return <div className="page-stack"><PageHeader action={<Link href="/import-export/contracts/new"><Button leftIcon={<Plus aria-hidden="true" size={16}/>} variant="primary">Tạo hợp đồng mua hàng</Button></Link>} title="Hợp đồng mua hàng"/><ContractListView/></div>;}
