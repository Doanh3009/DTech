import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { listTestAccounts } from "@/features/testing/server";
export async function GET() {
  try { return successResponse(await listTestAccounts()); } catch (error) { return errorResponse(error); }
}
