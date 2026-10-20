import { describe, expect, it } from "vitest";

import { isValidAccountPassword } from "@/lib/auth/passwordPolicy";

describe("account password policy", () => {
  it("accepts any password with at least eight characters", () => {
    expect(isValidAccountPassword("12345678")).toBe(true);
    expect(isValidAccountPassword("1234567")).toBe(false);
    expect(isValidAccountPassword("123456789")).toBe(true);
    expect(isValidAccountPassword("MixedCasePassword")).toBe(true);
    expect(isValidAccountPassword("mật-khẩu-rất-dài")).toBe(true);
  });
});
