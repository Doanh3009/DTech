import { describe,expect,it } from "vitest";
import { eventCategory,formatWaitingHours,humanizeAuditAction,renderTemplate,sanitizeAuditValue,validateTemplate } from "./rules";

describe("shared platform rules",()=>{
  it("renders only declared notification placeholders",()=>{expect(validateTemplate("Đơn {{request_number}} của {{password}}",["request_number"])).toEqual(["Placeholder không được phép: {{password}}."]);expect(renderTemplate("Đơn {{request_number}}",{request_number:"LV-001"})).toBe("Đơn LV-001");});
  it("rejects markup in text templates",()=>{expect(validateTemplate("<script>alert(1)</script>",[])).toContain("HTML không được hỗ trợ.");});
  it("maps events to preference categories",()=>{expect(eventCategory("approval.required")).toBe("approval");expect(eventCategory("shipment.eta.changed")).toBe("shipment");expect(eventCategory("unknown.event")).toBe("system");});
  it("redacts nested secrets from audit changes",()=>{expect(sanitizeAuditValue({profile:{name:"An",password:"secret"},accessToken:"abc"})).toEqual({profile:{name:"An",password:"[REDACTED]"},accessToken:"[REDACTED]"});});
  it("provides human readable action labels and waiting hours",()=>{expect(humanizeAuditAction("leave.approved")).toBe("Duyệt đơn nghỉ");expect(formatWaitingHours("2026-09-12T00:00:00.000Z",new Date("2026-09-12T05:30:00.000Z").getTime())).toBe(5);});
});
