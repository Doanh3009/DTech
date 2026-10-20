import { MessageCenter } from "@/features/messaging/MessageCenter";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getRequestUser()]);
  return <div className="page-stack"><MessageCenter activeId={id} canCreateGroup={Boolean(user && can(user.permissions, "chat.group.create"))} key={id} /></div>;
}
