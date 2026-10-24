import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { ControlCenterShell } from "@/features/crm/ControlCenterShell";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { can, isAccountEnabled } from "@/lib/auth/permissions";
import { PermissionDeniedState } from "@/components/shared/States";
export const metadata={title:"Trung tâm triển khai",robots:{index:false,follow:false}};
export default async function Layout({children}:{children:ReactNode}){if(!controlCenterEnabled())notFound();const user=await getRequestUser();if(!user||!isAccountEnabled(user))redirect("/control-center/login");if(!can(user.permissions,"crm.view"))return <PermissionDeniedState/>;return <CurrentUserProvider user={user}><ControlCenterShell>{children}</ControlCenterShell></CurrentUserProvider>;}
