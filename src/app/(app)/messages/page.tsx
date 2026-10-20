import { MessageCenter } from "@/features/messaging/MessageCenter";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  return <div className="page-stack"><MessageCenter canCreateGroup={Boolean(user && can(user.permissions, "chat.group.create"))} /></div>;
}
