import { z } from "zod";

import { generateWorkerAttendanceExcel } from "@/features/worker-attendance/services/workerAttendanceExcel";
import { listWorkerSessions } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const querySchema = z.object({
  projectId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

export async function GET(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "timesheet.export")) throw new AppError("PERMISSION_DENIED");
    const search = new URL(request.url).searchParams;
    const input = parseWithSchema(querySchema, { projectId: search.get("projectId"), month: search.get("month") });
    const [year, month] = input.month.split("-").map(Number);
    const from = `${input.month}-01`;
    const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const sessions = await listWorkerSessions(user, { projectId: input.projectId, from, to });
    const bytes = await generateWorkerAttendanceExcel(sessions, input.month);
    return new Response(new Uint8Array(bytes), { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="Bang_cham_cong_cong_truong_${input.month}.xlsx"`,
      "cache-control": "private, no-store"
    } });
  } catch (error) {
    return errorResponse(error);
  }
}
