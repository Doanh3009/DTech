import { describe, expect, it } from "vitest";

import { normalizeUsername, usernameHtmlPattern, usernamePattern } from "@/lib/auth/username";

const browserUsernamePattern = new RegExp(`^(?:${usernameHtmlPattern})$`, "v");

describe("username validation", () => {
  it.each(["test.supervisor", "admin_01", "nhan-vien"])(
    "accepts %s in both server and browser validation",
    (username) => {
      expect(usernamePattern.test(username)).toBe(true);
      expect(browserUsernamePattern.test(username)).toBe(true);
    }
  );

  it.each(["ab", "1admin", "admin name", "admin@chau-tuan"])("rejects invalid username %s", (username) => {
    expect(usernamePattern.test(username)).toBe(false);
    expect(browserUsernamePattern.test(username)).toBe(false);
  });

  it("normalizes login input before authentication", () => {
    expect(normalizeUsername("  Test.Supervisor ")).toBe("test.supervisor");
  });
});
