import { notFound } from "next/navigation";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
import { BusinessLoginEntry } from "@/features/business/BusinessLoginEntry";
export const metadata={title:"Trải nghiệm DIMIXO ERP"};
export default function Page(){if(!controlCenterEnabled())notFound();return <BusinessLoginEntry/>;}
