import { redirect } from "next/navigation";
import { visibleApplications } from "@/config/moduleRegistry";
import { firstAccessibleRoute } from "@/features/dashboard/registry";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  const target = user ? visibleApplications(user).find((application) => application.id === "human-resources")?.defaultRoute : undefined;
  redirect(target ?? (user ? firstAccessibleRoute(user) : "/login"));
}
