import { businessIndustryKeys, type BusinessIndustry } from "@/features/business/businessCatalog";
import { CustomerWorkspace } from "@/features/crm/CustomerWorkspace";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { can } from "@/lib/auth/permissions";
import { PermissionDeniedState } from "@/components/shared/States";
import { notFound,redirect } from "next/navigation";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
export default async function Page({searchParams}:{searchParams:Promise<{industry?:string}>}){if(!controlCenterEnabled())notFound();const user=await getRequestUser();if(!user)redirect("/control-center/login");if(!can(user.permissions,"crm.view")||!can(user.permissions,"crm.manage"))return <PermissionDeniedState/>;const industry=(await searchParams).industry as BusinessIndustry;return <CustomerWorkspace initialIndustry={businessIndustryKeys.includes(industry)?industry:"general"}/>;}
