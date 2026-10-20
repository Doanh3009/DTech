import { z } from "zod";

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().finite().nonnegative(),
  capturedAt: z.string().datetime()
});

export const attendanceRecordInputSchema = z.object({
  clientEventId: z.string().uuid(),
  intendedType: z.enum(["check_in", "check_out"]).optional(),
  capturedAtClient: z.string().datetime(),
  capturedOffline: z.boolean(),
  location: coordinatesSchema.optional(),
  deviceMetadata: z.object({
    platform: z.string().max(120).optional(),
    browser: z.string().max(180).optional(),
    appVersion: z.string().max(40).optional()
  })
});

export const attendanceRecordFiltersSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  employeeId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  status: z.enum(["recorded", "rejected", "needs_review"]).optional(),
  photo: z.enum(["missing", "pending", "uploaded"]).optional()
});

export const attendanceAdjustmentSchema = z.object({
  effectiveAt: z.string().datetime(),
  attendanceStatus: z.enum(["recorded", "rejected", "needs_review"]),
  reason: z.string().trim().min(3).max(500)
});

export const attendancePolicyPatchSchema = z.object({
  attendanceEnabled: z.boolean(),
  photoRequired: z.boolean(),
  gpsRequired: z.boolean(),
  offlineEnabled: z.boolean(),
  allowedAccuracyThresholdMeters: z.number().int().min(10).max(1000),
  earlyCheckinWindowMinutes: z.number().int().min(0).max(360),
  lateThresholdMinutes: z.number().int().min(0).max(180),
  shiftName: z.string().trim().min(1).max(80),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/)
});

export const attendanceLocationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000),
  active: z.boolean().default(true)
});
