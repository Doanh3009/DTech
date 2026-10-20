import { z } from "zod";

const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Ngày không hợp lệ.")
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Ngày không hợp lệ.");
export const attendanceAdjustmentRequestSchema = z.object({
  attendanceDate: date,
  requestType: z.enum(["missing_check_in", "missing_check_out"]),
  requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ."),
  reason: z.string().trim().min(5).max(1000)
}).strict();

export const attendanceAdjustmentReviewSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(1000).optional().default("")
}).strict().refine((value) => value.approve || value.note.length >= 5, { message: "Cần ghi rõ lý do từ chối.", path: ["note"] });
