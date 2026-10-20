import { z } from "zod";

import { AppError } from "@/lib/api/errors";

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const firstMessage = result.error.issues[0]?.message;
    const actionableMessage = firstMessage && /[À-ỹ]/u.test(firstMessage) ? firstMessage : undefined;
    throw new AppError("VALIDATION_ERROR", actionableMessage, result.error.flatten());
  }

  return result.data;
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Nội dung yêu cầu không phải JSON hợp lệ.");
  }
  return parseWithSchema(schema, body);
}
