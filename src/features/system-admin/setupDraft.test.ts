import { describe, expect, it } from "vitest";
import { defaultSystemSettings } from "@/config/systemSettings";
import { parseSetupDraftGroups, readStoredSetupDraft, setupDraftStorageKey, storedSetupDraftSchema } from "./setupDraft";
import { erpModuleKeys } from "@/config/erpModules";

function draft() {
  const { branding, organization, localization, modules } = structuredClone(defaultSystemSettings);
  const groups = { branding, organization, localization, modules };
  const versions = { branding: 4, organization: 7, localization: 2, modules: 8 };
  return { formatVersion: 1, savedAt: "2026-10-21T01:00:00.000Z", step: 3, selectedIndustry: "general", baseline: { groups: structuredClone(groups), versions: structuredClone(versions) }, draft: structuredClone(groups), pendingCommand: { requestId: "6042e771-aeb9-4a0e-bbc6-36ce82e3177e", groups: structuredClone(groups), expectedVersions: structuredClone(versions), changeType: "publish" } };
}

describe("browser setup drafts", () => {
  it("isolates user, application origin and Supabase project scopes", () => {
    const key = setupDraftStorageKey("admin-a", "https://erp.customer.invalid", "https://one.supabase.co");
    expect(key).not.toBe(setupDraftStorageKey("admin-b", "https://erp.customer.invalid", "https://one.supabase.co"));
    expect(key).not.toBe(setupDraftStorageKey("admin-a", "https://other.customer.invalid", "https://one.supabase.co"));
    expect(key).not.toBe(setupDraftStorageKey("admin-a", "https://erp.customer.invalid", "https://two.supabase.co"));
  });
  it("round-trips a fully validated pending command without changing its versions", () => {
    const stored = draft();
    const result = readStoredSetupDraft({ getItem: () => JSON.stringify(stored) }, "key");
    expect(result).toEqual({ draft: stored, invalid: false });
  });
  it("expands legacy optional module flags to explicit booleans while preserving disabled flags", () => {
    const input = draft().draft;
    delete input.modules.accounting;
    delete input.modules.operations;
    delete input.modules.messaging;
    input.modules.warehouse = false;
    const parsed = parseSetupDraftGroups(input);
    expect(parsed.modules).toMatchObject({ accounting: true, operations: true, messaging: true, warehouse: false });
    expect(erpModuleKeys.every((key) => typeof parsed.modules[key] === "boolean")).toBe(true);
    expect(parsed.modules.industryPreset).toBe("general");
  });
  it("keeps legacy normalization stable when persisting an already normalized command", () => {
    const stored = draft();
    delete stored.draft.modules.accounting;
    delete stored.draft.modules.operations;
    delete stored.draft.modules.messaging;
    stored.pendingCommand.groups = parseSetupDraftGroups(stored.draft);
    const parsed = storedSetupDraftSchema.parse(stored);
    expect(JSON.stringify(parseSetupDraftGroups(parsed.draft))).toBe(JSON.stringify(parsed.draft));
    expect(parsed.pendingCommand?.groups).toEqual(parsed.draft);
  });
  it.each(["accounting", "operations", "messaging"] as const)("preserves an explicitly disabled %s flag through draft and command parsing", (key) => {
    const stored = draft();
    stored.draft.modules[key] = false;
    stored.pendingCommand.groups = parseSetupDraftGroups(stored.draft);
    const parsed = storedSetupDraftSchema.parse(stored);
    expect(parsed.draft.modules[key]).toBe(false);
    expect(parsed.pendingCommand?.groups.modules[key]).toBe(false);
  });
  it("handles absent or malformed storage without constructing defaults", () => {
    expect(readStoredSetupDraft({ getItem: () => null }, "key")).toEqual({ draft: null, invalid: false });
    expect(readStoredSetupDraft({ getItem: () => "broken" }, "key")).toEqual({ draft: null, invalid: true });
    expect(readStoredSetupDraft({ getItem: () => "{}" }, "key")).toEqual({ draft: null, invalid: true });
  });
  it("rejects a pending command whose draft differs from the saved payload", () => {
    const stored = structuredClone(draft());
    stored.draft.organization = { ...stored.draft.organization, companyName: "Changed" };
    expect(storedSetupDraftSchema.safeParse(stored).success).toBe(false);
  });
  it("rejects a pending command whose baseline versions were rebased", () => {
    const stored = structuredClone(draft());
    stored.baseline.versions = { ...stored.baseline.versions, organization: 10 };
    expect(storedSetupDraftSchema.safeParse(stored).success).toBe(false);
  });
  it("rejects unknown fields, unsupported locales, invalid versions and format upgrades", () => {
    const stored = draft();
    expect(storedSetupDraftSchema.safeParse({ ...stored, secret: "forbidden" }).success).toBe(false);
    expect(storedSetupDraftSchema.safeParse({ ...stored, formatVersion: 2 }).success).toBe(false);
    expect(storedSetupDraftSchema.safeParse({ ...stored, step: 8 }).success).toBe(false);
    expect(storedSetupDraftSchema.safeParse({ ...stored, selectedIndustry: "unsupported" }).success).toBe(false);
    expect(storedSetupDraftSchema.safeParse({ ...stored, baseline: { ...stored.baseline, versions: { ...stored.baseline.versions, modules: -1 } } }).success).toBe(false);
    expect(storedSetupDraftSchema.safeParse({ ...stored, draft: { ...stored.draft, localization: { ...stored.draft.localization, locale: "en-US" } } }).success).toBe(false);
  });
});
