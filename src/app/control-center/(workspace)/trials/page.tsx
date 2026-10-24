import { notFound, redirect } from "next/navigation";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
import { TrialRequestsPage } from "@/features/marketing/TrialRequestsPage";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { can } from "@/lib/auth/permissions";
import { PermissionDeniedState } from "@/components/shared/States";
export default async function Page(){if(!controlCenterEnabled())notFound();const user=await getRequestUser();if(!user)redirect("/control-center/login");if(!can(user.permissions,"crm.view")||!can(user.permissions,"trial_request.view"))return <PermissionDeniedState/>;return <TrialRequestsPage/>;}
