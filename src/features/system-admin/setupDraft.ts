import { z } from "zod";
import { erpModuleKeys, industryKeys, isErpModuleEnabled } from "@/config/erpModules";
import { systemSettingsSchemas } from "@/config/systemSettings";

export const setupGroups = ["branding", "organization", "localization", "modules"] as const;
export type SetupGroup = typeof setupGroups[number];
const groupsSchema = z.object({
  branding: systemSettingsSchemas.branding,
  organization: systemSettingsSchemas.organization,
  localization: systemSettingsSchemas.localization,
  modules: systemSettingsSchemas.modules.transform((modules) => systemSettingsSchemas.modules.parse({ ...modules, ...Object.fromEntries(erpModuleKeys.map((key) => [key, isErpModuleEnabled(modules, key)])) }))
}).strict();
const versionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const versionsSchema = z.object({ branding: versionSchema, organization: versionSchema, localization: versionSchema, modules: versionSchema }).strict();
const commandSchema = z.object({ requestId: z.string().uuid(), groups: groupsSchema, expectedVersions: versionsSchema, changeType: z.literal("publish") }).strict();

export const storedSetupDraftSchema = z.object({
  formatVersion: z.literal(1),
  savedAt: z.string().datetime(),
  step: z.number().int().min(0).max(3),
  selectedIndustry: z.enum(industryKeys),
  baseline: z.object({ groups: groupsSchema, versions: versionsSchema }).strict(),
  draft: groupsSchema,
  pendingCommand: commandSchema.nullable()
}).strict().superRefine((value, context) => {
  if (value.pendingCommand && (JSON.stringify(value.pendingCommand.groups) !== JSON.stringify(value.draft) || JSON.stringify(value.pendingCommand.expectedVersions) !== JSON.stringify(value.baseline.versions))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["pendingCommand"], message: "Bản nháp không khớp yêu cầu xuất bản." });
  }
});

export type SetupDraft = z.infer<typeof groupsSchema>;
export type PublishCommand = z.infer<typeof commandSchema>;
export type StoredSetupDraft = z.infer<typeof storedSetupDraftSchema>;

export function parseSetupDraftGroups(value: unknown): SetupDraft {
  return groupsSchema.parse(value);
}

export function setupDraftStorageKey(userId: string, appOrigin: string, supabaseOrigin: string): string {
  return ["dtech-setup-draft-v1", appOrigin, supabaseOrigin, userId].map(encodeURIComponent).join(":");
}

export function readStoredSetupDraft(storage: Pick<Storage, "getItem">, key: string): { draft: StoredSetupDraft | null; invalid: boolean } {
  const raw = storage.getItem(key);
  if (raw === null) return { draft: null, invalid: false };
  try {
    const parsed = storedSetupDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { draft: parsed.data, invalid: false } : { draft: null, invalid: true };
  } catch { return { draft: null, invalid: true }; }
}
