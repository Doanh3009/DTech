import { EmployeeDetailPage } from "@/features/employees/pages/EmployeeDetailPage";

export default async function Page({
  params
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  const { id, section } = await params;
  return <EmployeeDetailPage employeeId={id} section={section} />;
}
