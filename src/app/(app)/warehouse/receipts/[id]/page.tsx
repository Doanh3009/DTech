import { WarehouseDocumentRoute } from "@/features/warehouse";
export default async function Page({params}:{params:Promise<{id:string}>}){return <WarehouseDocumentRoute id={(await params).id} title="Phiếu nhập kho" type="receipt"/>;}
