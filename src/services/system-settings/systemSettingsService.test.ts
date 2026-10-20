import { beforeEach, describe, expect, it } from "vitest";

import { defaultSystemSettings } from "@/config/systemSettings";
import {
  listSettingsVersions,
  publishSettingsGroup,
  readSettingsGroup,
  resetLocalSystemSettingsForTests,
  restoreSettingsVersion
} from "@/services/system-settings/systemSettingsService";

describe("system settings publishing", () => {
  beforeEach(() => resetLocalSystemSettingsForTests());

  it("publishes a validated group and records a version", async () => {
    const value = { ...defaultSystemSettings.appearance, primaryColor: "#114F8B" };
    const result = await publishSettingsGroup({ group: "appearance", value, actorId: "demo-admin" });
    expect(result.version).toBe(2);
    expect((await readSettingsGroup("appearance")).primaryColor).toBe("#114F8B");
    expect(await listSettingsVersions()).toHaveLength(1);
  });

  it("rejects malformed stored input before it can be published", async () => {
    await expect(publishSettingsGroup({
      group: "modules",
      value: { ...defaultSystemSettings.modules, arbitrary_module: true },
      actorId: "demo-admin"
    })).rejects.toThrow();
  });

  it("restores a supported settings snapshot", async () => {
    await publishSettingsGroup({
      group: "branding",
      value: { ...defaultSystemSettings.branding, systemName: "Phiên bản A" },
      actorId: "demo-admin"
    });
    const [version] = await listSettingsVersions();
    await publishSettingsGroup({
      group: "branding",
      value: { ...defaultSystemSettings.branding, systemName: "Phiên bản B" },
      actorId: "demo-admin"
    });
    await restoreSettingsVersion(version.id, "demo-admin");
    expect((await readSettingsGroup("branding")).systemName).toBe("Phiên bản A");
    expect((await listSettingsVersions())[0].changeType).toBe("restore");
  });
});
