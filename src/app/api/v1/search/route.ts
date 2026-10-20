import { z } from "zod";

import { globalSearch } from "@/features/search/services/globalSearchService";
import { searchEntityTypes } from "@/features/search/types";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const querySchema = z.object({
  query: z.string().trim().min(2).max(120),
  types: z.array(z.enum(searchEntityTypes)).max(searchEntityTypes.length).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0)
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const types = url.searchParams.get("types")?.split(",").filter(Boolean);
    const input = parseWithSchema(querySchema, {
      query: url.searchParams.get("q"),
      types: types?.length ? types : undefined,
      limit: url.searchParams.get("limit") ?? 20,
      offset: url.searchParams.get("cursor") ?? 0
    });
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await globalSearch(user, input), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
