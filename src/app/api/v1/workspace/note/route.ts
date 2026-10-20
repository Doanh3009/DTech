import { personalNoteSchema } from "@/features/workspace/personalWorkspaceSchemas";
import { getPersonalNote, savePersonalNote } from "@/features/workspace/personalWorkspaceService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try { return successResponse(await getPersonalNote(requireAuthenticatedUser(await getRequestUser()))); }
  catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = await parseJsonBody(request, personalNoteSchema);
    return successResponse(await savePersonalNote(user, input.content));
  } catch (error) { return errorResponse(error); }
}
