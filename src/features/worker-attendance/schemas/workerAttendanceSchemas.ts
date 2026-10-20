import { z } from "zod";

const locationSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().finite().nonnegative() });

export const createWorkerSessionSchema = z.object({
  clientSessionId: z.string().uuid(), projectId: z.string().uuid(), worksiteId: z.string().uuid(), date: z.string().date(),
  shiftCode: z.string().trim().min(1).max(30).default("DAY"), sessionType: z.enum(["morning", "end_of_day"]).default("morning"),
  capturedAtClient: z.string().datetime(), location: locationSchema.optional()
});

export const workerEntryPatchSchema = z.object({
  id: z.string().uuid(), status: z.enum(["unconfirmed", "present", "absent", "leave", "late", "transferred"]),
  exceptionReason: z.enum(["approved_leave", "unapproved", "unknown", "other_worksite", "other"]).nullable().optional(),
  dayException: z.enum(["none", "early_leave", "transferred", "half_day", "overtime", "left_worksite"]).default("none"),
  exceptionTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), note: z.string().trim().max(500).nullable().optional()
});

export const workerSessionDraftSchema = z.object({
  version: z.number().int().positive(), entries: z.array(workerEntryPatchSchema).max(500),
  workNote: z.string().trim().max(1500).nullable().optional(), note: z.string().trim().max(1000).nullable().optional(),
  checklistResponses: z.array(z.object({
    itemId: z.string().uuid(), checked: z.boolean(), note: z.string().trim().max(500).nullable().optional()
  })).max(100).default([]),
  location: locationSchema.optional()
});

export const workerSessionSubmitSchema = z.object({ version: z.number().int().positive() });

export const workerAdjustmentSchema = z.object({
  version: z.number().int().positive(), entryId: z.string().uuid(),
  status: z.enum(["present", "absent", "leave", "late", "transferred"]),
  reason: z.string().trim().min(3).max(500)
});

export const temporaryWorkerSchema = z.object({
  fullName: z.string().trim().min(2).max(120), phone: z.string().trim().max(20).optional(), contractorName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(), unplannedReason: z.enum(["mobilized", "support", "replacement", "other"])
});

export const existingWorkerSchema = z.object({
  workerId: z.string().uuid(),
  unplannedReason: z.enum(["mobilized", "support", "replacement", "other"])
});

export const closeWorkerDaySchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500).default("Chốt ngày"),
  entries: z.array(z.object({
    id: z.string().uuid(),
    dayException: z.enum(["none", "early_leave", "transferred", "half_day", "overtime", "left_worksite"]),
    exceptionTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional()
  })).max(500)
});

export const workerAttendanceReminderSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().date()
});
