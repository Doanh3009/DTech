import { describe, expect, it } from "vitest";

import { AppError, errorResponse } from "@/lib/api/errors";

describe("api errors", () => {
  it("maps permission errors to a safe Vietnamese response", async () => {
    const response = errorResponse(new AppError("PERMISSION_DENIED"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
        message: "Bạn không có quyền thực hiện thao tác này."
      }
    });
    expect(body.error.requestId).toEqual(expect.any(String));
  });
});
