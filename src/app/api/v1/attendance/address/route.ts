import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { resolveAttendanceAddress } from "@/features/attendance/services/attendanceAddressService";

const coordinatesSchema = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict();

async function readSmallPayload(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 256 || !request.body) throw new AppError("VALIDATION_ERROR");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256) { await reader.cancel(); throw new AppError("VALIDATION_ERROR"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError("VALIDATION_ERROR"); }
}

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = coordinatesSchema.safeParse(await readSmallPayload(request));
    if (!input.success) throw new AppError("VALIDATION_ERROR");
    // POST keeps precise GPS out of route URLs, access logs and shared HTTP caches.
    return successResponse(await resolveAttendanceAddress(user, input.data), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
