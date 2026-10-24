import { AttendanceCameraExperience } from "@/features/attendance/components/AttendanceCameraExperience";
import { PermissionDeniedState } from "@/components/shared/States";
import { canSubmitPersonalAttendance } from "@/lib/auth/applicationAccess";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function QuickAttendancePage() {
  const user = await getRequestUser();
  if (!user || !canSubmitPersonalAttendance(user.permissions)) return <PermissionDeniedState />;
  return <><h1 className="sr-only">Chấm công nhanh</h1><AttendanceCameraExperience initialCapture returnHref="/personal" /></>;
}
