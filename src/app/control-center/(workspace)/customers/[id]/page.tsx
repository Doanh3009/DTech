import { CustomerWorkspace } from "@/features/crm/CustomerWorkspace";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CustomerWorkspace key={id} id={id}/>;}
