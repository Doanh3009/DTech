import { describe, expect, it } from "vitest";

import { isSessionInactive, SESSION_INACTIVITY_TIMEOUT_MS } from "@/services/auth/sessionService";

describe("session inactivity timeout", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");

  it("keeps a session active before twelve inactive hours", () => {
    expect(isSessionInactive(new Date(now - SESSION_INACTIVITY_TIMEOUT_MS + 1).toISOString(), now)).toBe(false);
  });

  it("expires a session at twelve inactive hours", () => {
    expect(isSessionInactive(new Date(now - SESSION_INACTIVITY_TIMEOUT_MS).toISOString(), now)).toBe(true);
  });

  it("fails closed when the activity timestamp is invalid", () => {
    expect(isSessionInactive("invalid", now)).toBe(true);
  });
});
