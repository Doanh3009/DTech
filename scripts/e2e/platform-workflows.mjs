import { readFile } from "node:fs/promises";
export function registerPlatformCases(s) {
  const { test, assert, state, need, api, create, uuid } = s;
  const f = () => s.fixture, employee = () => s.people.employee.employeeId;
  const future = "2097-11-01";
  async function upload(route, metadata, name) {
    const response = await s.context("admin").request.post(s.baseUrl + route, { multipart: { metadata: JSON.stringify(metadata), file: { name, mimeType: "image/png", buffer: await readFile(new URL("../testing/fixtures/mock-field-report.png", import.meta.url)) } } });
    const body = await response.json(); assert.equal(response.status(), 201, body.error?.message); return body.data;
  }
  async function xlsx(route, role = "admin") {
    const response = await s.context(role).request.get(s.baseUrl + route);
    assert.equal(response.status(), 200); assert((await response.body()).subarray(0, 2).toString() === "PK");
  }
  test("SHIFT-01", "Tạo ca riêng và đọc lại cấu hình ca", async () => {
    state.testShiftInput = { code: `${f().prefix}_SHIFT`.slice(0, 30), name: `${f().prefix} Ca thử nghiệm`, startTime: "08:00", endTime: "17:00", breakMinutes: 60, lateGraceMinutes: 5, earlyLeaveGraceMinutes: 5, checkInEarliestMinutes: 60, checkInLatestMinutes: 120, checkOutEarliestMinutes: 120, checkOutLatestMinutes: 120, crossMidnight: false, active: true };
    state.testShift = await create("admin", "/api/v1/shifts", state.testShiftInput, "shifts");
    assert((await api("admin", "GET", "/api/v1/shifts")).shifts.some((row) => row.id === state.testShift.id));
  });
  test("SHIFT-02", "Gán ca và ngày nghỉ chỉ cho nhân viên E2E", async () => {
    need("testShift");
    await create("admin", "/api/v1/shifts/assignments", { shiftId: state.testShift.id, scopeType: "employee", scopeId: employee(), effectiveFrom: future, effectiveTo: "2097-11-02", weekdays: [1, 2, 3, 4, 5] }, "shift_assignments");
    const day = await create("admin", "/api/v1/work-calendar", { scopeType: "employee", scopeId: employee(), date: future, name: `${f().prefix} Ngày nghỉ riêng`, dayType: "special", isWorkingDay: false, active: true }, "work_calendar_days");
    assert((await api("admin", "GET", `/api/v1/work-calendar?from=${future}&to=${future}`)).some((row) => row.id === day.id && row.scopeId === employee()));
  });
  test("SHIFT-03", "Đổi phiên bản ca có ngày/lý do; chặn giờ sai", async () => {
    need("testShift");
    state.testShift = await api("admin", "PATCH", "/api/v1/shifts", { ...state.testShiftInput, id: state.testShift.id, effectiveFrom: future, reason: "E2E đổi ca riêng", startTime: "08:30" });
    const shifts = await api("admin", "GET", "/api/v1/shifts");
    assert(shifts.versions.some((row) => row.shift_id === state.testShift.id));
    await api("admin", "POST", "/api/v1/shifts", { ...state.testShiftInput, code: `${state.testShiftInput.code}_X`, startTime: "99:00" }, [400]);
  });
  test("DOC-01", "Upload tài liệu hư cấu và kiểm tra file riêng", async () => {
    const types = await api("admin", "GET", "/api/v1/document-types"); assert(types.length);
    state.testDocument = await upload("/api/v1/documents", { title: `${f().prefix} Tài liệu bàn giao`, documentTypeId: types[0].id }, "e2e-field.png");
    await f().track("documents", state.testDocument.id); await f().track("file_assets", state.testDocument.fileId);
    const rows = await api("admin", "GET", `/api/v1/documents?q=${f().prefix}`);
    assert(rows.some((row) => row.id === state.testDocument.id));
    const response = await s.context("admin").request.get(`${s.baseUrl}/api/v1/documents/${state.testDocument.id}/download`);
    assert.equal(response.status(), 200); assert((await response.body()).subarray(0, 8).toString("hex") === "89504e470d0a1a0a");
  });
  test("DOC-02", "Thay file giữ đủ hai phiên bản và file cũ", async () => {
    need("testDocument"); const oldFile = state.testDocument.fileId;
    state.testDocument = await upload(`/api/v1/documents/${state.testDocument.id}/versions`, { changeNote: "E2E cập nhật tài liệu" }, "e2e-field-v2.png");
    await f().track("file_assets", state.testDocument.fileId);
    const result = await api("admin", "GET", `/api/v1/documents/${state.testDocument.id}`);
    assert.equal(result.document.currentVersion, 2); assert.equal(result.versions.length, 2);
    assert(result.versions.some((row) => row.file_id === oldFile));
  });
  test("DOC-03", "Chặn nhân viên lưu trữ tài liệu; Admin archive và chặn lặp", async () => {
    need("testDocument"); const route = `/api/v1/documents/${state.testDocument.id}/archive`;
    await api("employee", "POST", route, {}, [403]); await api("admin", "POST", route, {});
    assert.equal((await api("admin", "GET", `/api/v1/documents/${state.testDocument.id}`)).document.status, "archived");
    await api("admin", "POST", route, {}, [409]);
  });
  test("REPORT-01", "Tạo và sửa mẫu báo cáo riêng theo phiên bản", async () => {
    const input = { code: `${f().prefix}_REPORT`, name: `${f().prefix} Báo cáo công`, reportType: "timesheet", active: true, definition: { freezeHeader: true, autoFilter: true, sheets: [{ key: "summary", name: "Tong hop", enabled: true }] } };
    state.testReportTemplate = await create("admin", "/api/v1/report-templates", input, "report_templates");
    const version = state.testReportTemplate.version;
    state.testReportTemplate = await api("admin", "PATCH", "/api/v1/report-templates", { ...input, id: state.testReportTemplate.id, name: `${f().prefix} Báo cáo công v2` });
    assert.equal(state.testReportTemplate.version, version + 1);
  });
  test("REPORT-02", "Xuất kỳ công thật thành XLSX; người khác không tải được", async () => {
    need("testReportTemplate", "period");
    state.testReport = await create("admin", "/api/v1/report-exports", { templateId: state.testReportTemplate.id, periodId: state.period.id }, "report_exports");
    assert.equal(state.testReport.status, "completed");
    await xlsx(`/api/v1/report-exports/${state.testReport.id}/download`);
    await api("employee", "GET", `/api/v1/report-exports/${state.testReport.id}`, undefined, [403]);
  });
  test("REPORT-03", "Chặn xuất thiếu kỳ và mẫu không tồn tại", async () => {
    need("testReportTemplate");
    await api("admin", "POST", "/api/v1/report-exports", { templateId: state.testReportTemplate.id }, [400]);
    await api("admin", "POST", "/api/v1/report-exports", { templateId: uuid() }, [404]);
  });
  test("WORKSPACE-01", "Ghi chú cá nhân không xuất hiện ở tài khoản khác", async () => {
    const content = `${f().prefix} Ghi chú riêng`;
    await api("employee", "PUT", "/api/v1/workspace/note", { content });
    assert.equal((await api("employee", "GET", "/api/v1/workspace/note")).content, content);
    assert(!(await api("outsider", "GET", "/api/v1/workspace/note")).content.includes(f().prefix));
  });
  test("WORKSPACE-02", "Tạo việc cá nhân và chặn sửa/xóa khác chủ", async () => {
    state.testTodo = await create("employee", "/api/v1/workspace/todos", { title: `${f().prefix} Kiểm tra bàn giao`, priority: "high" }, "user_todos");
    assert((await api("employee", "GET", "/api/v1/workspace/todos")).some((row) => row.id === state.testTodo.id));
    await api("outsider", "PATCH", `/api/v1/workspace/todos/${state.testTodo.id}`, { completed: true }, [404]);
    await api("outsider", "DELETE", `/api/v1/workspace/todos/${state.testTodo.id}`, undefined, [404]);
  });
  test("WORKSPACE-03", "Hoàn thành/xóa việc cá nhân và validation tiêu đề", async () => {
    need("testTodo"); const route = `/api/v1/workspace/todos/${state.testTodo.id}`;
    assert.equal((await api("employee", "PATCH", route, { completed: true })).completed, true);
    await api("employee", "DELETE", route);
    assert(!(await api("employee", "GET", "/api/v1/workspace/todos")).some((row) => row.id === state.testTodo.id));
    await api("employee", "POST", "/api/v1/workspace/todos", { title: " " }, [400]);
  });
  test("INTEGRATION-01", "Tạo service account riêng với scope thực", async () => {
    state.testServiceAccount = await create("admin", "/api/v1/integrations/service-accounts", { code: `${f().prefix}_SA`, name: `${f().prefix} Service test`, scopes: ["employees.read"] }, "service_accounts");
    await api("employee", "GET", "/api/v1/integrations/service-accounts", undefined, [403]);
  });
  test("INTEGRATION-02", "API key chỉ nhận scope service account; secret không lưu plaintext", async () => {
    need("testServiceAccount");
    const input = { serviceAccountId: state.testServiceAccount.id, name: `${f().prefix} Key test`, environment: "test", scopes: ["employees.read"] };
    await api("admin", "POST", "/api/v1/integrations/api-keys", { ...input, scopes: ["warehouse.write"] }, [400]);
    state.testApiKey = await create("admin", "/api/v1/integrations/api-keys", input, "api_keys");
    assert(state.testApiKey.secret?.startsWith("ct_test_"));
    const row = await f().query(f().db.from("api_keys").select("key_hash").eq("id", state.testApiKey.id).single(), "API key hash");
    assert(row.key_hash && row.key_hash !== state.testApiKey.secret, "Không được lưu token plaintext");
    const rows = await api("admin", "GET", "/api/v1/integrations/api-keys");
    assert(!JSON.stringify(rows).includes(state.testApiKey.secret), "Danh sách không được trả secret");
  });
  test("INTEGRATION-03", "Rotate key thu hồi khóa cũ và revoke khóa mới", async () => {
    need("testApiKey");
    const rotated = await api("admin", "POST", `/api/v1/integrations/api-keys/${state.testApiKey.id}/rotate`, {});
    await f().track("api_keys", rotated.id); assert(rotated.secret !== state.testApiKey.secret, "Rotate cần token mới");
    const old = await f().query(f().db.from("api_keys").select("status").eq("id", state.testApiKey.id).single(), "rotated key"); assert.equal(old.status, "revoked");
    await api("admin", "POST", `/api/v1/integrations/api-keys/${rotated.id}/revoke`, {});
    await api("admin", "POST", `/api/v1/integrations/api-keys/${rotated.id}/revoke`, {}, [409]);
  });
  test("INTEGRATION-04", "Đăng ký webhook hư cấu; không cấu hình provider thật", async () => {
    const events = await f().query(f().db.from("event_schema_registry").select("event_key").eq("active", true).eq("version", 1).limit(1), "event catalog"); assert(events.length);
    state.testWebhook = await create("admin", "/api/v1/integrations/webhooks", { name: `${f().prefix} Webhook disabled test`, targetUrl: "https://ct-noibo-fixture.invalid/events", eventTypes: [events[0].event_key] }, "webhook_endpoints");
  });
  test("INTEGRATION-05", "Gửi thử bị chặn trước network; không có delivery attempt", async () => {
    need("testWebhook");
    await api("admin", "POST", `/api/v1/integrations/webhooks/${state.testWebhook.id}/test`, {}, [403]);
    const rows = await f().query(f().db.from("webhook_deliveries").select("id,status,attempt_count").eq("endpoint_id", state.testWebhook.id), "blocked deliveries");
    assert(rows.length); assert(rows.every((row) => row.attempt_count === 0 && row.status === "pending"));
    const attempts = await f().query(f().db.from("webhook_delivery_attempts").select("id").in("delivery_id", rows.map((row) => row.id)), "delivery attempts"); assert.equal(attempts.length, 0);
    await api("admin", "PATCH", `/api/v1/integrations/webhooks/${state.testWebhook.id}`, { enabled: false });
  });
}
