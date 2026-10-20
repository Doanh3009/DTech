import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteIdentityDocument, createIdentityDocumentUrl, replaceIdentityDocument } from "@/features/employees/services/identityDocumentService";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid(), side: z.enum(["front", "back"]) });

export async function GET(_request: Request, context: RouteContext<"/api/v1/employees/[id]/identity-documents/[side]">) {
  try {
    const input = parseWithSchema(paramsSchema, await context.params);
    const url = await createIdentityDocumentUrl(requireAuthenticatedUser(await getRequestUser()), input.id, input.side);
    return NextResponse.redirect(url, 307);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext<"/api/v1/employees/[id]/identity-documents/[side]">) {
  try {
    const input = parseWithSchema(paramsSchema, await context.params);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Thiếu ảnh giấy tờ.");
    return successResponse(await replaceIdentityDocument(requireAuthenticatedUser(await getRequestUser()), input.id, input.side, file));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/v1/employees/[id]/identity-documents/[side]">) {
  try {
    const input = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await deleteIdentityDocument(requireAuthenticatedUser(await getRequestUser()), input.id, input.side));
  } catch (error) { return errorResponse(error); }
}
