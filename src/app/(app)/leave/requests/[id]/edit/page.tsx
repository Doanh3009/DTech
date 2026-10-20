import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeaveRequestForm } from "@/features/leave/components/LeaveRequestForm";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="page-stack"><BackLink href={`/leave/requests/${id}`} /><PageHeader title="Sửa đơn nháp" /><LeaveRequestForm key={id} requestId={id} /></div>;
}
