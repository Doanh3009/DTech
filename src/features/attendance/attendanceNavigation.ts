const attendanceReturnRoutes = [
  /^\/attendance\/(?:logs|today)(?:\?.*)?$/,
  /^\/employees\/[^/?#]+\/attendance(?:\?.*)?$/
] as const;

export function attendanceRecordBackHref(returnTo?: string): string {
  if (!returnTo || !attendanceReturnRoutes.some((pattern) => pattern.test(returnTo))) return "/attendance/logs";
  return returnTo;
}

export function attendanceRecordHref(recordId: string, returnTo: string): string {
  return `/attendance/records/${encodeURIComponent(recordId)}?returnTo=${encodeURIComponent(attendanceRecordBackHref(returnTo))}`;
}

export function attendanceLogBackHref(employeeId?: string): string {
  return employeeId
    ? `/employees/${encodeURIComponent(employeeId)}/attendance`
    : "/attendance/today";
}
