import { z } from "zod";

import { createWorkerChecklistItem, deleteWorkerChecklistItem, listWorkerChecklist, updateWorkerChecklistItem } from "@/features/worker-attendance/services/workerChecklistService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const itemSchema = z.object({
  group: z.string().trim().min(1).max(80), content: z.string().trim().min(2).max(300), required: z.boolean(), active: z.boolean(), sortOrder: z.number().int().min(0).max(10000)
});
const updateSchema = itemSchema.extend({ id: z.string().uuid(), rowVersion: z.number().int().positive() });
const deleteSchema = z.object({ id: z.string().uuid() });

export async function GET() {
  try { return successResponse(await listWorkerChecklist(requireAuthenticatedUser(await getRequestUser()))); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try { return successResponse(await createWorkerChecklistItem(requireAuthenticatedUser(await getRequestUser()), parseWithSchema(itemSchema, await request.json())), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try { const input = parseWithSchema(updateSchema, await request.json()); return successResponse(await updateWorkerChecklistItem(requireAuthenticatedUser(await getRequestUser()), input.id, input)); }
  catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try { const { id } = parseWithSchema(deleteSchema, await request.json()); return successResponse(await deleteWorkerChecklistItem(requireAuthenticatedUser(await getRequestUser()), id)); }
  catch (error) { return errorResponse(error); }
}
