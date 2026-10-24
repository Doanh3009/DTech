import { notFound, redirect } from "next/navigation";
import { controlCenterEnabled } from "@/features/crm/controlCenterAccess";

export default function Page() { if(!controlCenterEnabled())notFound(); redirect("/control-center/trials"); }
