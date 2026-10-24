import {notFound} from "next/navigation";
import {readBusinessWorkspace} from "@/features/business/businessService";
import {BusinessGovernanceWorkspace} from "@/features/business/BusinessGovernanceWorkspace";
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const w=await readBusinessWorkspace(slug);if(w.role!=="owner")notFound();return <BusinessGovernanceWorkspace workspace={w}/>;}
