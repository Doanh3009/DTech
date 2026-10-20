const tokenPattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function validateTemplate(template: string, allowed: readonly string[]): string[] {
  if (/<[^>]+>/.test(template)) return ["HTML không được hỗ trợ."];
  const unknown = [...template.matchAll(tokenPattern)].map(match => match[1]).filter(token => !allowed.includes(token));
  return [...new Set(unknown)].map(token => `Placeholder không được phép: {{${token}}}.`);
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(tokenPattern, (_match, token: string) => values[token] ?? "");
}

export function eventCategory(eventKey: string): string {
  if (eventKey.startsWith("approval.")) return "approval";
  if (eventKey.startsWith("project.")) return "project";
  if (eventKey.startsWith("shipment.")) return "shipment";
  if (eventKey.startsWith("warehouse.")) return "warehouse";
  if (eventKey.startsWith("document.")) return "document";
  return "system";
}

export function humanizeAuditAction(action: string): string {
  const exact: Record<string, string> = { "leave.approved": "Duyệt đơn nghỉ", "leave.rejected": "Từ chối đơn nghỉ", "approval.reassigned": "Chuyển người duyệt", "document.replaced": "Thay phiên bản tài liệu", "document.archived": "Lưu trữ tài liệu", "system.notice.created": "Tạo thông báo hệ thống" };
  return exact[action] ?? action.split(/[._]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
}

const sensitiveKeyPattern = /(password|token|secret|authorization|cookie|national.?id|cccd|bank.?account)/i;
export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitizeAuditValue(nested)]));
  return value;
}

export function formatWaitingHours(submittedAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(submittedAt).getTime()) / 3_600_000));
}
