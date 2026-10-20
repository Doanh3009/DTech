import { BackLink } from "@/components/shared/BackLink";import { PageHeader } from "@/components/shared/PageHeader";import { CalendarSettings } from "@/features/timesheets/components/CalendarSettings";
export default function Page(){return <div className="page-stack"><BackLink href="/settings/attendance"/><PageHeader title="Lịch ngày làm việc và ngày nghỉ"/><CalendarSettings/></div>;}
