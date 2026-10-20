import { EmployeeListPage } from "@/features/employees/pages/EmployeeListPage";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EmployeeListPage searchParams={await searchParams} />;
}
