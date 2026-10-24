// @vitest-environment node
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ readFile: vi.fn(), realpath: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, realpath: mocks.realpath }));
import { assertRealWorkspaceFile, deploymentEnvironment, workspace } from "./deployment-manifest.mjs";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.realpath.mockImplementation(async (filename) => filename);
});

describe("separate deployment environment selection", () => {
  it("keeps the existing inherited-env workflow when no file is selected", async () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SECRET_KEY: "fixture-key" };
    expect(await deploymentEnvironment(undefined, env)).toEqual(env);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("does not borrow missing target keys from the current instance", async () => {
    mocks.readFile.mockResolvedValue("NEXT_PUBLIC_SUPABASE_URL=https://selected.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=selected-public\n");
    const env = await deploymentEnvironment(".env.customer.local", {
      NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "other-secret",
      SUPABASE_SECRET_KEY: "other-new-secret", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "other-public", PATH: "fixture-path", DTECH_CONTROL_CENTER_ENABLED:"true"
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://selected.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("selected-public");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.SUPABASE_SECRET_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeUndefined();
    expect(env.PATH).toBe("fixture-path");
    expect(env.DTECH_CONTROL_CENTER_ENABLED).toBe("false");
  });

  it("rejects a symlink before reading another file", async () => {
    mocks.realpath.mockResolvedValue("C:/somewhere-else/secrets");
    await expect(deploymentEnvironment(".env.customer.local", {})).rejects.toThrow(/symlink/);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("permits a not-yet-created local destination", async () => {
    mocks.realpath.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    await expect(assertRealWorkspaceFile(path.join(workspace, ".env.new-customer.local"))).resolves.toBeUndefined();
  });

  it("does not expose unreadable environment file contents", async () => {
    mocks.readFile.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(deploymentEnvironment(".env.customer.local", {})).rejects.not.toThrow(/synthetic-secret-never-log/);
  });
});
