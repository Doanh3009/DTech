import { afterEach, describe, expect, it } from "vitest";

import { acquireBodyScrollLock } from "@/lib/ui/bodyScrollLock";

describe("body scroll lock", () => {
  afterEach(() => { document.body.style.overflow = ""; });

  it("keeps the body locked until the final overlapping overlay closes", () => {
    document.body.style.overflow = "auto";
    const releaseFirst = acquireBodyScrollLock();
    const releaseSecond = acquireBodyScrollLock();
    releaseFirst();
    expect(document.body.style.overflow).toBe("hidden");
    releaseSecond();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("allows an idempotent cleanup", () => {
    const release = acquireBodyScrollLock();
    release();
    release();
    expect(document.body.style.overflow).toBe("");
  });
});
