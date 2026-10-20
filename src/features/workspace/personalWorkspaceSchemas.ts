import { z } from "zod";

export const personalNoteSchema = z.object({ content: z.string().max(8000) });
export const todoCreateSchema = z.object({
  title: z.string().trim().min(1).max(240),
  dueDate: z.string().date().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium")
});
export const todoPatchSchema = todoCreateSchema.partial().extend({ completed: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0, "Cần có dữ liệu cập nhật.");
export const uiPreferencesSchema = z.object({
  density: z.enum(["compact", "default", "comfortable"]),
  sidebarCollapsed: z.boolean(),
  pinnedModules: z.array(z.string().trim().min(1).max(80)).max(20),
  dashboardWidgetVisibility: z.record(z.boolean()),
  dashboardWidgetOrder: z.array(z.string().trim().min(1).max(80)).max(30),
  themePreference: z.enum(["system", "light"])
});
