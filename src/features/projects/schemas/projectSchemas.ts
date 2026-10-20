import { z } from "zod";

const optionalText = (maximum: number) => z.preprocess((value) => value === "" || value == null ? undefined : value, z.string().trim().max(maximum).optional());
const optionalDate = z.preprocess((value) => value === "" || value == null ? undefined : value, z.string().date().optional());
const optionalUuid = z.preprocess((value) => value === "" || value == null ? undefined : value, z.string().uuid().optional());

export const projectInputSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(3).max(180),
  customerName: optionalText(160),
  summary: optionalText(500),
  startDate: z.string().date(),
  expectedEndDate: optionalDate,
  status: z.enum(["preparing", "active", "paused", "completed", "closed"]).default("preparing"),
  projectManagerEmployeeId: optionalUuid,
  note: optionalText(1000)
}).refine((value) => !value.expectedEndDate || value.expectedEndDate >= value.startDate, { message: "Ngày kết thúc dự kiến không hợp lệ.", path: ["expectedEndDate"] });

export const worksiteInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: optionalText(300),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(10).max(5000).default(200),
  gpsRequired: z.boolean().default(true),
  allowedAccuracyThresholdMeters: z.number().int().min(10).max(1000).default(100),
  activeFrom: optionalDate,
  activeTo: optionalDate
}).refine((value) => (value.latitude === undefined) === (value.longitude === undefined), { message: "Cần nhập đủ tọa độ.", path: ["latitude"] });

export const assignmentInputSchema = z.object({
  employeeId: z.string().uuid(),
  worksiteId: optionalUuid,
  assignmentRole: z.enum(["project_manager", "engineer", "supervisor_main", "supervisor_replacement", "worker", "support"]),
  startDate: z.string().date(),
  endDate: optionalDate,
  shiftCode: z.string().trim().min(1).max(30).default("DAY"),
  shiftName: z.string().trim().min(1).max(80).default("Ca ngày"),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/).default("17:00"),
  note: optionalText(500)
}).refine((value) => !value.endDate || value.endDate >= value.startDate, { message: "Khoảng phân công không hợp lệ.", path: ["endDate"] });

const updateTypeSchema = z.enum(["progress", "issue", "material", "safety", "change", "general"]);
const updateStatusSchema = z.enum(["in_progress", "waiting", "done"]);
const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const projectUpdateInputSchema = z.object({
  clientUpdateId: optionalUuid,
  worksiteId: optionalUuid,
  updateType: updateTypeSchema,
  title: optionalText(180),
  content: z.string().trim().min(3).max(10000),
  status: updateStatusSchema.default("in_progress"),
  publishStatus: z.enum(["draft", "published"]).default("published"),
  issueFlag: z.boolean().default(false),
  issueSeverity: severitySchema.optional(),
  issueOwnerEmployeeId: optionalUuid,
  relatedAttendanceSessionId: optionalUuid,
  capturedAtClient: z.string().datetime({ offset: true }).optional()
}).superRefine((value, context) => {
  if (value.issueFlag && !value.issueSeverity) context.addIssue({ code: z.ZodIssueCode.custom, path: ["issueSeverity"], message: "Chọn mức độ vấn đề." });
  if (!value.issueFlag && value.issueSeverity) context.addIssue({ code: z.ZodIssueCode.custom, path: ["issueSeverity"], message: "Mức độ chỉ dùng khi có vấn đề." });
});

export const projectUpdatePatchSchema = z.object({
  title: optionalText(180),
  content: z.string().trim().min(3).max(10000).optional(),
  status: updateStatusSchema.optional(),
  issueSeverity: severitySchema.optional(),
  issueOwnerEmployeeId: optionalUuid,
  rowVersion: z.number().int().positive(),
  reason: optionalText(500)
}).refine((value) => Object.keys(value).some((key) => !["rowVersion", "reason"].includes(key)), { message: "Không có nội dung thay đổi." });

export const projectHealthInputSchema = z.object({
  health: z.enum(["on_track", "at_risk", "delayed", "paused", "completed"]),
  reason: optionalText(500)
}).superRefine((value, context) => {
  if (value.health === "delayed" && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Cần nhập lý do khi dự án chậm tiến độ." });
});

export const issueResolutionSchema = z.object({
  resolutionNote: z.string().trim().min(3).max(2000),
  rowVersion: z.number().int().positive().optional()
});

export const issueReopenSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  rowVersion: z.number().int().positive().optional()
});

export const projectUpdateQuerySchema = z.object({
  type: updateTypeSchema.optional(),
  status: updateStatusSchema.optional(),
  severity: severitySchema.optional(),
  issueOnly: z.enum(["true", "false"]).optional(),
  pinned: z.enum(["true", "false"]).optional(),
  worksiteId: optionalUuid,
  authorEmployeeId: optionalUuid,
  search: optionalText(200),
  from: optionalDate,
  to: optionalDate,
  cursor: optionalText(200),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const projectProgressInputSchema = z.object({
  id: z.string().uuid().optional(),
  parentId: optionalUuid,
  nodeType: z.enum(["phase", "work_item", "task", "milestone", "acceptance"]),
  name: z.string().trim().min(2).max(200),
  status: z.enum(["not_started", "in_progress", "blocked", "completed", "cancelled"]),
  completionPercent: z.number().int().min(0).max(100),
  deadline: optionalDate,
  assigneeEmployeeId: optionalUuid,
  sortOrder: z.number().int().min(0).max(10000).default(0),
  rowVersion: z.number().int().positive().optional()
}).superRefine((value, context) => {
  if (value.id && !value.rowVersion) context.addIssue({ code: "custom", path: ["rowVersion"], message: "Thiếu phiên bản dữ liệu." });
  if (value.status === "completed" && value.completionPercent !== 100) context.addIssue({ code: "custom", path: ["completionPercent"], message: "Hạng mục hoàn thành phải đạt 100%." });
});
