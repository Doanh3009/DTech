import { z } from "zod";

import { todoPatchSchema } from "@/features/workspace/personalWorkspaceSchemas";
import { deletePersonalTodo, updatePersonalTodo } from "@/features/workspace/personalWorkspaceService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ todoId: z.string().uuid() });

export async function PATCH(request: Request, context: RouteContext<"/api/v1/workspace/todos/[todoId]">) {
  try {
    const { todoId } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await updatePersonalTodo(user, todoId, await parseJsonBody(request, todoPatchSchema)));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/v1/workspace/todos/[todoId]">) {
  try {
    const { todoId } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await deletePersonalTodo(requireAuthenticatedUser(await getRequestUser()), todoId));
  } catch (error) { return errorResponse(error); }
}
