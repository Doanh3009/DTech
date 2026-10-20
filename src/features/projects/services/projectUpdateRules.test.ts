import { describe, expect, it } from "vitest";
import { projectHealthInputSchema, projectUpdateInputSchema } from "@/features/projects/schemas/projectSchemas";
import type { ProjectIssue } from "@/features/projects/types/projectTypes";
import { createProjectUpdateTitle, getProjectCloseWarning, isProjectStale, sortIssuesForAttention } from "@/features/projects/services/projectUpdateRules";

const issue = (id: string, severity: ProjectIssue["severity"], status: ProjectIssue["status"], createdAt: string): ProjectIssue => ({ id, projectId: "project", projectName: "Dự án", sourceUpdateId: `update-${id}`, title: id, severity, status, createdAt, updatedAt: createdAt });

describe("project update rules", () => {
  it("tạo tiêu đề ngắn từ nội dung", () => expect(createProjectUpdateTitle(undefined, "  Hoàn thành   kiểm tra QC03  ")).toBe("Hoàn thành kiểm tra QC03"));
  it("rút gọn tiêu đề dài", () => expect(createProjectUpdateTitle(undefined, "a".repeat(100))).toHaveLength(90));
  it("không yêu cầu phần trăm tiến độ", () => expect(projectUpdateInputSchema.parse({ updateType: "progress", content: "Đang vệ sinh QC03" }).status).toBe("in_progress"));
  it("yêu cầu severity khi đánh dấu vấn đề", () => expect(projectUpdateInputSchema.safeParse({ updateType: "issue", content: "Thiếu vật tư", issueFlag: true }).success).toBe(false));
  it("không cho severity đứng độc lập", () => expect(projectUpdateInputSchema.safeParse({ updateType: "general", content: "Thông tin ca", issueSeverity: "high" }).success).toBe(false));
  it("yêu cầu lý do khi chuyển sang chậm tiến độ", () => expect(projectHealthInputSchema.safeParse({ health: "delayed" }).success).toBe(false));
  it("không coi thiếu cập nhật là chậm tiến độ", () => expect(isProjectStale(undefined, 3)).toBe(true));
  it("nhận diện cập nhật cũ theo ngưỡng", () => expect(isProjectStale("2026-09-01T00:00:00Z", 3, new Date("2026-09-05T00:00:01Z"))).toBe(true));
  it("xếp nghiêm trọng trước và bỏ vấn đề đã xử lý", () => { const result = sortIssuesForAttention([issue("low", "low", "open", "2026-09-01"), issue("done", "critical", "resolved", "2026-08-01"), issue("critical", "critical", "open", "2026-09-02")]); expect(result.map((item) => item.id)).toEqual(["critical", "low"]); });
  it("cảnh báo vấn đề mở trước khi đóng dự án", () => expect(getProjectCloseWarning([issue("high", "high", "open", "2026-09-01")])).toContain("1 vấn đề"));
});
