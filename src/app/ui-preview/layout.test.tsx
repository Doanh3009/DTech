import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
import UiPreviewLayout from "./layout";

afterEach(() => vi.unstubAllEnvs());

describe("development UI previews", () => {
  it("does not publish demo screens in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => UiPreviewLayout({ children: "demo" })).toThrow("NEXT_NOT_FOUND");
  });
  it("preserves development component previews", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(UiPreviewLayout({ children: "demo" })).toBe("demo");
  });
});
