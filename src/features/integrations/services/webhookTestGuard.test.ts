import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.db }));
import { deliverWebhook } from "./webhookService";
describe("test webhook delivery cannot reach network or database", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it.each(["development", "staging", "test"])("blocks %s before accessing delivery or fetching URL", async (environment) => {
    vi.stubEnv("APP_ENV", environment); vi.stubGlobal("fetch", mocks.fetch);
    await expect(deliverWebhook("unit-delivery")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("blocks a staging release even if APP_ENV is mistakenly production", async () => {
    vi.stubEnv("APP_ENV", "production"); vi.stubEnv("RELEASE_ENVIRONMENT", "staging"); vi.stubGlobal("fetch", mocks.fetch);
    await expect(deliverWebhook("unit-delivery")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
