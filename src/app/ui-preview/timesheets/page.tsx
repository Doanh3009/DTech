import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { TimesheetPeriodList } from "@/features/timesheets/components/TimesheetPeriodList";
import type { TimesheetPeriod } from "@/features/timesheets/types/timesheetTypes";

const previewPeriods: TimesheetPeriod[] = [
  { id: "preview-open", code: "TEST-2026-10", name: "[TEST DATA] Kỳ công tháng 10", startDate: "2026-10-01", endDate: "2026-10-31", status: "open", version: 1, rowVersion: 1 },
  { id: "preview-review", code: "TEST-2026-09", name: "[TEST DATA] Kỳ công đang rà soát", startDate: "2026-09-01", endDate: "2026-09-30", status: "reviewing", version: 2, rowVersion: 2 },
  { id: "preview-locked", code: "TEST-2026-08", name: "[TEST DATA] Kỳ công đã khóa", startDate: "2026-08-01", endDate: "2026-08-31", status: "locked", version: 1, rowVersion: 1 }
];

export default function TimesheetsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="page-main ui-preview-page" id="main-content"><div className="page-stack"><PageHeader title="Kỳ công" /><TimesheetPeriodList initialItems={previewPeriods} /></div></main>;
}
