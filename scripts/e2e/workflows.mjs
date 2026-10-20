export function registerBusinessCases(s) {
  const { test, assert, state, need, api, create, uuid } = s;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const f = () => s.fixture;
  const person = (role) => s.people[role];
  const conflict = (role, method, route, body) => api(role, method, route, body, [409]);
  const invalid = (role, method, route, body) => api(role, method, route, body, [400]);
  async function multipart(role, route, body, statuses = [200, 201]) {
    const response = await s.context(role).request.post(s.baseUrl + route, { multipart: body, timeout: 30000 });
    const result = await response.json();
    assert(statuses.includes(response.status()), `${route}: HTTP ${response.status()} ${result.error?.message || ""}`);
    return result.data;
  }
  async function evidence() {
    if (state.evidenceJpeg) return state.evidenceJpeg;
    const page = await s.browser.newPage({ viewport: { width: 640, height: 480 } });
    try {
      await page.setContent('<main style="background:#e8f8ff;padding:48px;font:28px sans-serif;color:#245b78"><h1>CT NOI BO · TEST</h1><p>Ảnh giả lập công trường</p><p>Kiểm tra vật tư · an toàn · tiến độ</p></main>');
      state.evidenceJpeg = await page.screenshot({ type: "jpeg", quality: 80 });
    } finally { await page.close(); }
    return state.evidenceJpeg;
  }
  const uploadJpeg = (bytes) => ({ photo: { name: "e2e-evidence.jpg", mimeType: "image/jpeg", buffer: bytes }, thumbnail: { name: "e2e-thumbnail.jpg", mimeType: "image/jpeg", buffer: bytes }, width: "640", height: "480", capturedAt: new Date().toISOString() });
  async function binary(role, route, magic) {
    const response = await s.context(role).request.get(s.baseUrl + route);
    assert.equal(response.status(), 200, `${route}: ${await response.text().then((value) => value.slice(0, 100))}`);
    const bytes = await response.body();
    assert(bytes.length > 50 && bytes.subarray(0, magic.length).toString() === magic, `Tệp ${route} không đúng định dạng`);
  }
  test("AUTH-01", "API yêu cầu đăng nhập và trang được chuyển về đăng nhập", async () => {
    const context = await s.newContext();
    try {
      const response = await context.request.get(s.baseUrl + "/api/v1/employees");
      assert.equal(response.status(), 401);
      const page = await context.newPage();
      await page.goto(s.baseUrl + "/employees");
      await page.waitForURL((url) => url.pathname === "/login");
      assert.equal(new URL(page.url()).pathname, "/login");
    } finally { await context.close(); }
  }, "BROWSER + API");
  test("AUTH-02", "Mật khẩu sai bị từ chối", () => api("outsider", "POST", "/api/v1/auth/login", { username: person("outsider").username, password: "WrongE2e123!" }, [401]));
  for (const [id, role, route, method, body] of [
    ["01", "employee", "/api/v1/employees", "GET"], ["02", "employee", "/api/v1/accounting/salaries", "GET"],
    ["03", "employee", "/api/v1/accounting/payroll", "GET"], ["04", "employee", "/api/v1/warehouse/inventory", "GET"],
    ["05", "employee", "/api/v1/shipments", "GET"], ["06", "employee", "/api/v1/audit-log", "GET"],
    ["07", "employee", "/api/v1/settings-catalog", "GET"], ["08", "warehouse", "/api/v1/accounting/salaries", "GET"]
  ]) test(`RBAC-${id}`, `${role} bị chặn ${route}`, () => api(role, method, route, body, [403]));

  test("HR-01", "Tạo nhân viên và tìm lại trong danh sách", async () => {
    const input = { ...f().references, employeeCode: `${f().prefix}_HIRE`, fullName: `[E2E] Nhân viên tuyển mới ${f().manifest.runId}`, joinDate: today, employmentStatus: "active" };
    const result = await api("hr", "POST", "/api/v1/employees", input);
    state.hire = result.employee;
    state.hireInput = input;
    await f().track("employees", result.employee.id);
    const list = await api("hr", "GET", `/api/v1/employees?q=${input.employeeCode}`);
    assert(list.employees.items.some((item) => item.id === state.hire.id));
  });
  test("HR-02", "Không tạo trùng mã nhân viên", async () => { need("hireInput"); await conflict("hr", "POST", "/api/v1/employees", state.hireInput); });
  test("HR-03", "Dữ liệu nhân viên sai bị chặn", () => invalid("hr", "POST", "/api/v1/employees", { employeeCode: "", fullName: "A" }));
  test("HR-04", "Sửa hồ sơ có phiên bản và đọc lại", async () => {
    need("hire");
    const result = await api("hr", "PATCH", `/api/v1/employees/${state.hire.id}`, { displayName: `[E2E] Đã cập nhật`, rowVersion: state.hire.rowVersion || 1 });
    const fresh = await api("hr", "GET", `/api/v1/employees/${state.hire.id}`);
    assert(JSON.stringify(fresh).includes("Đã cập nhật"));
    state.hireUpdated = result;
  });
  test("HR-05", "Tạo hợp đồng nhân viên mới và đọc lại", async () => {
    need("hire");
    state.hireContract = await multipart("hr", `/api/v1/employees/${state.hire.id}/contracts`, { contractNumber: `${f().prefix}_HD`, contractType: "Hợp đồng thử nghiệm", effectiveDate: today, signedDate: today, status: "active", note: "E2E dữ liệu giả lập" });
    await f().track("employee_contracts", state.hireContract.id);
    const result = await api("hr", "GET", `/api/v1/employees/${state.hire.id}/contracts`);
    assert(result.contracts.some((row) => row.id === state.hireContract.id));
  });
  test("HR-06", "Ghi nhận tham gia bảo hiểm và đối chiếu hồ sơ", async () => {
    need("hire");
    await multipart("hr", "/api/v1/insurance", { metadata: JSON.stringify({ employeeId: state.hire.id, socialInsuranceNumber: `E2E${f().manifest.runId}`, participationStatus: "active", paymentStatus: "pending", startDate: today, contributionBase: 12000000, socialInsuranceEnabled: true, healthInsuranceEnabled: true, unemploymentInsuranceEnabled: true, changeType: "joined", effectiveDate: today, reason: "E2E đăng ký bảo hiểm giả lập" }) });
    const rows = await api("hr", "GET", "/api/v1/insurance");
    assert(JSON.stringify(rows).includes(state.hire.id));
  });
  test("ATT-01", "Chấm vào với GPS tại địa điểm cho phép", async () => {
    const dashboard = await api("employee", "GET", "/api/v1/attendance/dashboard");
    assert.equal(dashboard.nextAction, "check_in");
    const location = dashboard.locations[0];
    assert(location || !dashboard.policy.gpsRequired, "Chưa có địa điểm chấm công test");
    state.attendanceInput = { clientEventId: uuid(), capturedAtClient: new Date().toISOString(), capturedOffline: false, deviceMetadata: { platform: "E2E", browser: "Playwright" }, ...(location ? { location: { latitude: location.latitude, longitude: location.longitude, accuracy: 5, capturedAt: new Date().toISOString() } } : {}) };
    const result = await api("employee", "POST", "/api/v1/attendance/events", state.attendanceInput);
    state.checkIn = result.event; await f().track("attendance_events", state.checkIn.id);
    assert.equal(state.checkIn.eventType, "check_in");
    assert.equal(state.checkIn.employeeId, person("employee").employeeId);
  });
  test("ATT-02", "Gửi lại thao tác chấm công không tạo lượt mới", async () => {
    need("checkIn");
    const replay = await api("employee", "POST", "/api/v1/attendance/events", state.attendanceInput);
    assert.equal(replay.event.id, state.checkIn.id); assert.equal(replay.idempotentReplay, true);
    const rows = await f().query(f().db.from("attendance_events").select("id").eq("client_event_id", state.attendanceInput.clientEventId), "attendance replay count"); assert.equal(rows.length, 1);
  });
  test("ATT-03", "Tải ảnh chấm công và đồng bộ hoàn tất", async () => {
    need("checkIn");
    const result = await multipart("employee", `/api/v1/attendance/events/${state.checkIn.id}/photo`, uploadJpeg(await evidence()));
    assert.equal(result.event.photoStatus, "uploaded");
    assert.equal(result.event.syncStatus, "synced");
  });
  test("ATT-04", "Chấm ra rồi chặn lượt thứ ba trong ngày", async () => {
    need("checkIn");
    const result = await api("employee", "POST", "/api/v1/attendance/events", { ...state.attendanceInput, clientEventId: uuid(), capturedAtClient: new Date().toISOString() });
    await f().track("attendance_events", result.event.id); assert.equal(result.event.eventType, "check_out");
    await conflict("employee", "POST", "/api/v1/attendance/events", { ...state.attendanceInput, clientEventId: uuid(), capturedAtClient: new Date().toISOString() });
  });
  test("ATT-05", "Thời gian/GPS không hợp lệ và truy cập chéo hồ sơ bị chặn", async () => {
    await invalid("employee", "POST", "/api/v1/attendance/events", { clientEventId: uuid(), capturedAtClient: "invalid", capturedOffline: false, deviceMetadata: {} });
    need("checkIn");
    await api("outsider", "GET", `/api/v1/attendance/records/${state.checkIn.id}`, undefined, [403, 404]);
  });

  test("LEAVE-01", "Tạo luồng duyệt và loại phép riêng", async () => {
    state.leaveFlow = await create("admin", "/api/v1/leave-workflows", { code: `${f().prefix}_L`, name: `[E2E] Duyệt phép`, active: true, steps: [{ approverSource: "specific_user", specificAccountId: person("hr").accountId }] }, "leave_workflows");
    state.leaveType = await create("admin", "/api/v1/leave-types", { code: `${f().prefix}_L`, name: `[E2E] Phép năm`, tone: "info", deductsBalance: true, requiresReason: true, requiresAttachment: false, allowsHalfDay: true, allowsMultiDay: true, workflowId: state.leaveFlow.id, active: true }, "leave_types");
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 14);
    while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
    state.leaveDate = date.toISOString().slice(0, 10);
    await api("admin", "POST", "/api/v1/leave-balances/grants", { employeeIds: [person("employee").employeeId], year: date.getUTCFullYear(), leaveTypeId: state.leaveType.id, amount: 12, reason: "E2E cấp phép riêng", idempotencyKey: uuid() });
  });
  test("LEAVE-02", "Nhân viên tạo đơn nháp rồi gửi duyệt", async () => {
    need("leaveType");
    state.leaveInput = { leaveTypeId: state.leaveType.id, startDate: state.leaveDate, endDate: state.leaveDate, reason: "E2E nghỉ phép cá nhân" };
    state.leave = await create("employee", "/api/v1/leave-requests", state.leaveInput, "leave_requests");
    assert.equal(state.leave.status, "draft");
    state.leave = await api("employee", "POST", `/api/v1/leave-requests/${state.leave.id}/submit`, { version: state.leave.version });
    assert(["submitted", "pending_approval"].includes(state.leave.status));
  });
  test("LEAVE-03", "Nhân viên khác không đọc được đơn cá nhân", async () => { need("leave"); await api("outsider", "GET", `/api/v1/leave-requests/${state.leave.id}`, undefined, [403]); });
  test("LEAVE-04", "Người được chỉ định duyệt, sổ phép trừ đúng một ngày", async () => {
    need("leave");
    state.leave = await api("hr", "POST", `/api/v1/leave-requests/${state.leave.id}/approve`, { version: state.leave.version, comment: "E2E đã kiểm tra" });
    assert.equal(state.leave.status, "approved");
    assert.equal(state.leave.calculatedDays, 1);
    const ledger = await api("admin", "GET", `/api/v1/employees/${person("employee").employeeId}/leave-ledger?year=${state.leaveDate.slice(0, 4)}`);
    const usage = ledger.filter((row) => row.referenceId === state.leave.id && row.transactionType === "leave_usage");
    assert.equal(usage.length, 1);
    assert.equal(usage[0].amount, -1);
  });
  test("LEAVE-05", "Duyệt lại bị chặn và không trừ phép lần hai", async () => {
    need("leave");
    await api("hr", "POST", `/api/v1/leave-requests/${state.leave.id}/approve`, { version: state.leave.version }, [409]);
    const replay = await api("hr", "GET", `/api/v1/leave-requests/${state.leave.id}`);
    assert.equal(replay.status, "approved");
    assert.equal(replay.version, state.leave.version);
    const ledger = await api("admin", "GET", `/api/v1/employees/${person("employee").employeeId}/leave-ledger?year=${state.leaveDate.slice(0, 4)}`);
    const usage = ledger.filter((row) => row.referenceId === state.leave.id && row.transactionType === "leave_usage");
    assert.equal(usage.length, 1);
    assert.equal(usage[0].amount, -1);
  });
  test("LEAVE-06", "Tải phiếu nghỉ phép PDF thật", async () => { need("leave"); await binary("employee", `/api/v1/leave-requests/${state.leave.id}/pdf`, "%PDF"); });
  test("LEAVE-07", "Đơn mới được từ chối kèm lý do", async () => {
    need("leaveType");
    const date = new Date(state.leaveDate); date.setUTCDate(date.getUTCDate() + 7);
    let request = await create("employee", "/api/v1/leave-requests", { ...state.leaveInput, startDate: date.toISOString().slice(0, 10), endDate: date.toISOString().slice(0, 10) }, "leave_requests");
    request = await api("employee", "POST", `/api/v1/leave-requests/${request.id}/submit`, { version: request.version });
    request = await api("hr", "POST", `/api/v1/leave-requests/${request.id}/reject`, { version: request.version, comment: "E2E cần điều chỉnh lịch" });
    assert.equal(request.status, "rejected");
  });
  test("LEAVE-08", "Rút đơn đang chờ duyệt", async () => {
    need("leaveType");
    const date = new Date(state.leaveDate); date.setUTCDate(date.getUTCDate() + 14);
    let request = await create("employee", "/api/v1/leave-requests", { ...state.leaveInput, startDate: date.toISOString().slice(0, 10), endDate: date.toISOString().slice(0, 10) }, "leave_requests");
    request = await api("employee", "POST", `/api/v1/leave-requests/${request.id}/submit`, { version: request.version });
    request = await api("employee", "POST", `/api/v1/leave-requests/${request.id}/withdraw`, { version: request.version, reason: "E2E thay đổi lịch" });
    assert.equal(request.status, "withdrawn");
  });
  test("LEAVE-09", "Tổng hợp số dư toàn công ty giữ đúng phép và phản hồi dưới 10 giây", async () => {
    need("leave", "leaveType");
    const start = performance.now();
    const balances = await api("hr", "GET", `/api/v1/leave-balances?scope=all&year=${state.leaveDate.slice(0, 4)}`);
    assert(performance.now() - start < 10000, "Số dư phép toàn công ty tải quá 10 giây");
    const balance = balances.find((row) => row.employeeId === person("employee").employeeId && row.leaveTypeId === state.leaveType.id);
    assert(balance, "Thiếu số dư nhân viên E2E");
    assert.equal(balance.officialRemaining, 11);
    assert.equal(balance.pending, 0);
    assert.equal(balance.availableAfterPending, 11);
    await api("employee", "GET", "/api/v1/leave-balances?scope=all", undefined, [403]);
  });

  test("TIME-01", "Tạo kỳ công riêng, không đụng kỳ đang vận hành", async () => {
    const months = await f().query(f().db.from("payroll_periods").select("period_month"), "months");
    const occupied = new Set(months.map((row) => row.period_month));
    const year = 2080 + Number.parseInt(f().manifest.runId.slice(-2), 16) % 20;
    const month = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}-01`).find((date) => !occupied.has(date));
    assert(month, "Không còn tháng E2E trống");
    state.periodDate = month;
    state.period = await create("hr", "/api/v1/timesheet-periods", { code: `${f().prefix}_T`, name: `[E2E] Kỳ công`, startDate: month, endDate: month }, "timesheet_periods");
  });
  test("TIME-02", "Tổng hợp công và điều chỉnh công của nhân viên E2E", async () => {
    need("period");
    await api("hr", "POST", `/api/v1/timesheet-periods/${state.period.id}/recompute`, {});
    const detail = await api("hr", "GET", `/api/v1/timesheet-periods/${state.period.id}`);
    state.period = detail.period;
    assert(Array.isArray(detail.summaries));
    await api("hr", "POST", `/api/v1/timesheet-periods/${state.period.id}/adjustments`, { employeeId: person("employee").employeeId, workDate: state.periodDate, adjustmentType: "correct_work_fraction", correctedWorkFraction: 1, reason: "E2E đối chiếu đủ một ngày công", rowVersion: state.period.rowVersion });
    // Payroll uses only the owned employee snapshot. Other employees are excluded
    // before publishing so a test cannot send them payslips or chat notifications.
    await f().query(f().db.from("timesheet_period_summaries").delete().eq("period_id", state.period.id).neq("employee_id", person("employee").employeeId), "isolate payroll roster");
    await f().query(f().db.from("timesheet_period_summaries").update({ scheduled_workdays: 1, actual_workdays: 1 }).eq("period_id", state.period.id).eq("employee_id", person("employee").employeeId), "owned payroll snapshot");
  });
  test("TIME-03", "Khóa công, chặn tổng hợp lại, mở khóa có lý do rồi khóa lại", async () => {
    need("period");
    let detail = await api("hr", "GET", `/api/v1/timesheet-periods/${state.period.id}`);
    const exceptions = await api("hr", "GET", `/api/v1/timesheet-exceptions?periodId=${state.period.id}`);
    for (const exception of exceptions.filter((item) => item.status === "open")) await api("hr", "PATCH", `/api/v1/timesheet-exceptions/${exception.id}`, { status: "resolved", note: "E2E đã đối chiếu kỳ riêng" });
    detail = await api("hr", "GET", `/api/v1/timesheet-periods/${state.period.id}`);
    await api("hr", "POST", `/api/v1/timesheet-periods/${state.period.id}/lock`, { rowVersion: detail.period.rowVersion });
    await conflict("hr", "POST", `/api/v1/timesheet-periods/${state.period.id}/recompute`, {});
    detail = await api("hr", "GET", `/api/v1/timesheet-periods/${state.period.id}`);
    assert.equal(detail.period.status, "locked");
    await api("hr", "POST", `/api/v1/timesheet-periods/${state.period.id}/unlock`, { rowVersion: detail.period.rowVersion, reason: "E2E kiểm tra mở khóa" });
    detail = await api("hr", "GET", `/api/v1/timesheet-periods/${state.period.id}`);
    await api("hr", "POST", `/api/v1/timesheet-periods/${state.period.id}/lock`, { rowVersion: detail.period.rowVersion });
    state.lockedPeriod = true;
  });
  test("PAY-01", "Lưu mức lương hiệu lực và đọc lịch sử", async () => {
    state.salary = await create("accountant", "/api/v1/accounting/salaries", { employeeId: person("employee").employeeId, baseSalary: 12000000, allowance: 1000000, bonus: 500000, deduction: 200000, effectiveDate: today, reason: "E2E mức lương đã đối chiếu" }, "employee_salary_history");
    const salaries = await api("accountant", "GET", "/api/v1/accounting/salaries");
    assert(salaries.records.some((row) => row.id === state.salary.id));
  });
  test("PAY-02", "Lập và tính bảng lương từ kỳ công khóa", async () => {
    need("lockedPeriod", "salary");
    state.payroll = await create("accountant", "/api/v1/accounting/payroll", { timesheetPeriodId: state.period.id, note: f().prefix }, "payroll_periods");
    state.payroll = await api("accountant", "PATCH", `/api/v1/accounting/payroll/${state.payroll.id}`, { action: "calculate", rowVersion: state.payroll.rowVersion });
    assert.equal(state.payroll.status, "calculated");
    assert.equal(state.payroll.lines.length, 1);
    assert.equal(state.payroll.lines[0].netSalary, 13300000);
  });
  test("PAY-03", "Chặn cập nhật bằng phiên bản cũ", async () => { need("payroll"); await conflict("accountant", "PATCH", `/api/v1/accounting/payroll/${state.payroll.id}`, { action: "calculate", rowVersion: 1 }); });
  test("PAY-03B", "Sửa dòng đã kiểm tra buộc kiểm tra lại và đổi phiên bản kỳ lương", async () => {
    need("payroll");
    state.payroll=await api("accountant","PATCH",`/api/v1/accounting/payroll/${state.payroll.id}`,{action:"review",rowVersion:state.payroll.rowVersion});
    const before=state.payroll,row=before.lines[0];
    state.payroll=await api("accountant","PATCH",`/api/v1/accounting/payroll/${before.id}`,{action:"update_line",rowVersion:before.rowVersion,lineId:row.id,lineRowVersion:row.rowVersion,baseSalary:row.baseSalary,allowance:row.allowance,bonus:row.bonus+100000,deduction:row.deduction,reason:"E2E điều chỉnh thưởng sau kiểm tra"});
    assert.equal(state.payroll.status,"calculated");assert.equal(state.payroll.rowVersion,before.rowVersion+1);assert.equal(state.payroll.lines[0].netSalary,row.netSalary+100000);
    await conflict("accountant","PATCH",`/api/v1/accounting/payroll/${before.id}`,{action:"lock",rowVersion:before.rowVersion});
  });
  test("PAY-03C", "Hai thao tác đồng thời chỉ một phiên bản được ghi", async () => {
    need("payroll");const context=s.context("accountant"),version=state.payroll.rowVersion;
    const responses=await Promise.all([1,2].map(()=>context.request.patch(s.baseUrl+`/api/v1/accounting/payroll/${state.payroll.id}`,{data:{action:"calculate",rowVersion:version}})));
    assert.deepEqual(responses.map(response=>response.status()).sort(),[200,409]);
    state.payroll=await api("accountant","GET",`/api/v1/accounting/payroll/${state.payroll.id}`);
    assert.equal(state.payroll.rowVersion,version+1);
  });
  test("PAY-04", "Kiểm tra → khóa → phát hành đúng nhân viên E2E", async () => {
    need("payroll");
    for (const action of ["review", "lock", "publish"]) state.payroll = await api("accountant", "PATCH", `/api/v1/accounting/payroll/${state.payroll.id}`, { action, rowVersion: state.payroll.rowVersion });
    assert.equal(state.payroll.status, "published");
    const slips = await api("employee", "GET", "/api/v1/accounting/payslips?scope=self");
    state.payslip = slips.find((row) => row.payrollLineId === state.payroll.lines[0].id && row.employeeId === person("employee").employeeId);
    assert(state.payslip, "Nhân viên chưa nhận phiếu lương");
    await f().track("payslips", state.payslip.id);
  });
  test("PAY-05", "Bảng lương phát hành không tính lại được", async () => { need("payroll"); await conflict("accountant", "PATCH", `/api/v1/accounting/payroll/${state.payroll.id}`, { action: "calculate", rowVersion: state.payroll.rowVersion }); });
  test("PAY-06", "Không đọc được phiếu lương của người khác", async () => { need("payslip"); await api("outsider", "GET", `/api/v1/accounting/payslips/${state.payslip.id}`, undefined, [404]); });
  test("PAY-07", "Xuất bảng lương XLSX và phiếu lương PDF", async () => { need("payslip"); await binary("accountant", `/api/v1/accounting/payroll/${state.payroll.id}/export`, "PK"); await binary("employee", `/api/v1/accounting/payslips/${state.payslip.id}/download`, "%PDF"); });
  test("PAY-08", "Nhân viên xác nhận phiếu đã gửi; thao tác lặp không tạo xác nhận mới", async () => {
    need("payslip");
    await api("outsider","POST",`/api/v1/accounting/payslips/${state.payslip.id}/confirm`,{version:state.payslip.version},[404]);
    const confirmed=await api("employee","POST",`/api/v1/accounting/payslips/${state.payslip.id}/confirm`,{version:state.payslip.version});
    assert(confirmed.confirmedAt);const repeated=await api("employee","POST",`/api/v1/accounting/payslips/${state.payslip.id}/confirm`,{version:state.payslip.version});assert.equal(repeated.confirmedAt,confirmed.confirmedAt);
  });
  test("PAY-09", "Khóa lương bảo vệ dòng lương và chặn mở công trước khi mở lại lương", async () => {
    need("payslip");
    const {error}=await f().db.from("payroll_lines").update({bonus:1}).eq("id",state.payroll.lines[0].id);
    assert(error?.message.includes("PAYROLL_LOCKED"));
    const detail=await api("hr","GET",`/api/v1/timesheet-periods/${state.period.id}`);
    await conflict("hr","POST",`/api/v1/timesheet-periods/${state.period.id}/unlock`,{rowVersion:detail.period.rowVersion,reason:"E2E thử mở công khi lương phát hành"});
  });
  test("PAY-10", "Mở lại thu hồi phiếu cũ; công đổi phiên bản buộc tính lại", async () => {
    need("payslip");const oldSlip=state.payslip;
    state.payroll=await api("accountant","PATCH",`/api/v1/accounting/payroll/${state.payroll.id}`,{action:"reopen",rowVersion:state.payroll.rowVersion,reason:"E2E kiểm tra phiên bản nguồn công"});
    const {data:old}=await f().db.from("payslips").select("status,confirmed_at").eq("id",oldSlip.id).single();assert.equal(old.status,"revoked");assert(old.confirmed_at);
    let detail=await api("hr","GET",`/api/v1/timesheet-periods/${state.period.id}`);
    await api("hr","POST",`/api/v1/timesheet-periods/${state.period.id}/unlock`,{rowVersion:detail.period.rowVersion,reason:"E2E rà soát lại kỳ công"});
    detail=await api("hr","GET",`/api/v1/timesheet-periods/${state.period.id}`);
    await api("hr","POST",`/api/v1/timesheet-periods/${state.period.id}/lock`,{rowVersion:detail.period.rowVersion});
    await conflict("accountant","PATCH",`/api/v1/accounting/payroll/${state.payroll.id}`,{action:"review",rowVersion:state.payroll.rowVersion});
    state.payroll=await api("accountant","GET",`/api/v1/accounting/payroll/${state.payroll.id}`);
    for(const action of ["calculate","review","lock","publish"])state.payroll=await api("accountant","PATCH",`/api/v1/accounting/payroll/${state.payroll.id}`,{action,rowVersion:state.payroll.rowVersion});
    const slips=await api("employee","GET","/api/v1/accounting/payslips?scope=self");state.payslip=slips.find(row=>row.payrollLineId===state.payroll.lines[0].id);
    assert.equal(state.payslip.version,oldSlip.version+1);assert(!state.payslip.confirmedAt);
  });

  test("PROJECT-01", "Tạo gói, công trường và phân công đúng phạm vi", async () => {
    state.project = await create("admin", "/api/v1/projects", { code: `${f().prefix}_P`, name: `[E2E] Công trường kiểm thử`, startDate: today, status: "active", projectManagerEmployeeId: person("admin").employeeId }, "projects");
    state.site = await create("admin", `/api/v1/projects/${state.project.id}/worksites`, { name: "[E2E] Khu thi công", gpsRequired: false }, "worksites");
    for (const [role, assignmentRole] of [["supervisor", "supervisor_main"], ["outsider", "worker"]]) {
      await create("admin", `/api/v1/projects/${state.project.id}/assignments`, { employeeId: person(role).employeeId, worksiteId: state.site.id, assignmentRole, startDate: today }, "project_assignments");
    }
    const project = await api("supervisor", "GET", `/api/v1/projects/${state.project.id}`);
    assert.equal(project.id, state.project.id);
  });
  test("PROJECT-02", "Tạo nhật ký có vấn đề và cập nhật tiến độ", async () => {
    need("project");
    state.update = await create("supervisor", `/api/v1/projects/${state.project.id}/updates`, { clientUpdateId: uuid(), updateType: "issue", title: "[E2E] Thiếu vật tư", content: "E2E phát hiện thiếu vật tư tại công trường", issueFlag: true, issueSeverity: "high", worksiteId: state.site.id }, "project_updates");
    const issues = await api("admin", "GET", `/api/v1/projects/${state.project.id}/issues`);
    state.issue = issues.find((issue) => issue.sourceUpdateId === state.update.id) || issues[0];
    assert(state.issue);
    const progressName = `${f().prefix} Lắp đặt`;
    const nodes = await api("admin", "POST", `/api/v1/projects/${state.project.id}/progress`, { nodeType: "work_item", name: progressName, status: "in_progress", completionPercent: 50 });
    state.progress = nodes.find((node) => node.name === progressName);
    assert(state.progress, "Chưa lưu nút tiến độ");
    assert.equal(state.progress.completionPercent, 50);
    await f().track("project_progress_nodes", state.progress.id);
    const saved = await api("supervisor", "GET", `/api/v1/projects/${state.project.id}/progress`);
    assert(saved.some((node) => node.id === state.progress.id && node.completionPercent === 50));
  });
  test("PROJECT-03", "Xử lý vấn đề rồi mở lại có lý do", async () => {
    need("issue");
    const resolved = await api("admin", "POST", `/api/v1/project-issues/${state.issue.id}/resolve`, { resolutionNote: "E2E vật tư đã giao đủ", rowVersion: state.issue.rowVersion });
    assert.equal(resolved.status, "resolved");
    const reopened = await api("admin", "POST", `/api/v1/project-issues/${state.issue.id}/reopen`, { reason: "E2E cần kiểm tra lại", rowVersion: resolved.rowVersion });
    assert.equal(reopened.status, "open");
  });
  test("WORKER-01", "Mở phiên điểm danh có roster và chống ghi trùng", async () => {
    need("site");
    state.workerInput = { clientSessionId: uuid(), projectId: state.project.id, worksiteId: state.site.id, date: today, capturedAtClient: new Date().toISOString() };
    const result = await api("supervisor", "POST", "/api/v1/worker-attendance/sessions", state.workerInput);
    state.worker = result.session;
    await f().track("worker_attendance_sessions", state.worker.id);
    assert(state.worker.entries.some((row) => row.workerId === person("outsider").employeeId));
    const replay = await api("supervisor", "POST", "/api/v1/worker-attendance/sessions", state.workerInput);
    assert.equal(replay.session.id, state.worker.id);
    assert.equal(replay.idempotentReplay, true);
  });
  test("WORKER-02", "Chưa đủ checklist/ảnh thì không được gửi điểm danh", async () => { need("worker"); await invalid("supervisor", "POST", `/api/v1/worker-attendance/sessions/${state.worker.id}/submit`, { version: state.worker.version }); });
  test("WORKER-03", "Lưu trạng thái công nhân và nội dung công việc", async () => {
    need("worker");
    const checklist = state.worker.checklist;
    state.worker = await api("supervisor", "PATCH", `/api/v1/worker-attendance/sessions/${state.worker.id}/draft`, { version: state.worker.version, entries: state.worker.entries.map((row) => ({ id: row.id, status: "present" })), workNote: "E2E kiểm tra vận hành công trường", checklistResponses: checklist.map((item) => ({ itemId: item.id, checked: true })) });
    assert(state.worker.entries.every((row) => row.status === "present"));
    state.workerReady = true;
  });
  test("WORKER-04", "Đồng bộ đủ ảnh điểm danh theo chính sách", async () => {
    need("worker");
    const policy = await f().query(f().db.from("worker_attendance_policies").select("minimum_photos").eq("active", true).single(), "worker photo policy");
    const bytes = await evidence();
    for (let index = 0; index < Math.max(1, policy.minimum_photos); index++) state.worker = await multipart("supervisor", `/api/v1/worker-attendance/sessions/${state.worker.id}/photos`, { ...uploadJpeg(bytes), photoId: uuid() });
    assert(state.worker.photos.length >= policy.minimum_photos);
  });
  test("WORKER-05", "Gửi điểm danh và chốt ngày với ngoại lệ nửa ngày", async () => {
    need("worker", "workerReady");
    state.worker = await api("supervisor", "POST", `/api/v1/worker-attendance/sessions/${state.worker.id}/submit`, { version: state.worker.version });
    assert.equal(state.worker.status, "submitted");
    state.worker = await api("supervisor", "POST", `/api/v1/worker-attendance/sessions/${state.worker.id}/close-day`, { version: state.worker.version, reason: "E2E đối chiếu bàn giao cuối ngày", entries: state.worker.entries.map((row, index) => ({ id: row.id, dayException: index === 0 ? "half_day" : "none" })) });
    assert(state.worker.dayClosedAt); assert.equal(state.worker.entries[0].dayException, "half_day");
  });

  test("WH-01", "Tạo hàng hóa, đơn vị tính và hai kho riêng", async () => {
    state.uom = await create("warehouse", "/api/v1/uom", { code: f().manifest.runId, name: "[E2E] Cái", symbol: "cái", active: true }, "units_of_measure");
    state.item = await create("warehouse", "/api/v1/items", { itemCode: `${f().prefix}_I`, name: "[E2E] Vật tư thử nghiệm", baseUomId: state.uom.id }, "inventory_items");
    state.warehouse = await create("warehouse", "/api/v1/warehouses", { code: `${f().prefix}_A`, name: "[E2E] Kho A" }, "warehouses");
    state.warehouseB = await create("warehouse", "/api/v1/warehouses", { code: `${f().prefix}_B`, name: "[E2E] Kho B" }, "warehouses");
    await f().query(f().db.from("warehouse_user_scopes").insert({ warehouse_id: state.warehouse.id, account_id: person("shipping").accountId, can_view: true, can_operate: true }), "shipping receipt scope");
    state.transactionTypes = await api("warehouse", "GET", "/api/v1/warehouse/transaction-types");
  });
  async function document(type, quantity, extra = {}) {
    need("item", "warehouse");
    const transaction = state.transactionTypes.find((row) => row.documentType === type && row.code !== "COUNT_VARIANCE" && !row.projectRequired && !row.approvalRequired);
    assert(transaction, `Thiếu loại giao dịch ${type}`);
    const header = { documentDate: today, clientRequestId: uuid(), transactionTypeCode: transaction.code, ...extra };
    if (type !== "receipt") header.sourceWarehouseId = state.warehouse.id;
    if (type === "receipt") header.targetWarehouseId = state.warehouse.id;
    if (type === "transfer") header.targetWarehouseId = state.warehouseB.id;
    const body = { ...header, lines: [{ itemId: state.item.id, uomId: state.uom.id, quantity: Math.abs(quantity), ...(type === "adjustment" ? { adjustmentQuantity: quantity } : {}) }] };
    const routes = { receipt: "receipts", issue: "issues", transfer: "transfers", adjustment: "adjustments" };
    const route = `/api/v1/warehouse/${routes[type]}`;
    const record = await create("warehouse", route, body, "inventory_documents");
    return { record, route, body };
  }
  async function balance(warehouse, expected) {
    const rows = await api("warehouse", "GET", `/api/v1/warehouse/inventory?warehouseId=${warehouse.id}&itemId=${state.item.id}`);
    assert.equal(rows.find((row) => row.itemId === state.item.id)?.onHand || 0, expected);
  }
  test("WH-02", "Nhập 100 và gửi ghi sổ lại không tăng tồn lần hai", async () => {
    state.receipt = await document("receipt", 100);
    const post = { postingDate: today, idempotencyKey: uuid() };
    await api("warehouse", "POST", `${state.receipt.route}/${state.receipt.record.id}/post`, post);
    await api("warehouse", "POST", `${state.receipt.route}/${state.receipt.record.id}/post`, post);
    await balance(state.warehouse, 100);
    state.stockReady = true;
  });
  test("WH-03", "Phiếu đã ghi sổ không được sửa", async () => { need("stockReady"); await conflict("warehouse", "PATCH", `${state.receipt.route}/${state.receipt.record.id}`, { ...state.receipt.body, rowVersion: state.receipt.record.rowVersion }); });
  test("WH-04", "Xuất 30, chuyển 20, đối chiếu tồn hai kho", async () => {
    need("stockReady");
    state.issueDoc = await document("issue", 30);
    await api("warehouse", "POST", `${state.issueDoc.route}/${state.issueDoc.record.id}/post`, { postingDate: today, idempotencyKey: uuid() });
    const transfer = await document("transfer", 20);
    await api("warehouse", "POST", `${transfer.route}/${transfer.record.id}/post`, { postingDate: today, idempotencyKey: uuid() });
    await balance(state.warehouse, 50); await balance(state.warehouseB, 20);
    state.transferred = true;
  });
  test("WH-05", "Xuất vượt tồn bị chặn và tồn không thay đổi", async () => {
    need("transferred"); const excess = await document("issue", 500);
    await conflict("warehouse", "POST", `${excess.route}/${excess.record.id}/post`, { postingDate: today, idempotencyKey: uuid() });
    await balance(state.warehouse, 50);
  });
  test("WH-06", "Điều chỉnh giảm 5 kèm lý do", async () => {
    need("transferred"); const adjustment = await document("adjustment", -5, { note: "E2E kiểm kê chênh lệch" });
    await api("warehouse", "POST", `${adjustment.route}/${adjustment.record.id}/post`, { postingDate: today, idempotencyKey: uuid() });
    await balance(state.warehouse, 45); state.adjusted = true;
  });
  test("WH-07", "Đảo phiếu xuất và hoàn đúng 30 về kho", async () => {
    need("adjusted");
    const reversal = await api("warehouse", "POST", `${state.issueDoc.route}/${state.issueDoc.record.id}/reverse`, { reason: "E2E trả vật tư không dùng", postingDate: today, idempotencyKey: uuid() });
    if (reversal.id !== state.issueDoc.record.id) await f().track("inventory_documents", reversal.id);
    if (reversal.reversalDocumentId) await f().track("inventory_documents", reversal.reversalDocumentId);
    await balance(state.warehouse, 75);
  });
  test("WH-08", "Sổ kho đối chiếu với tồn", async () => {
    need("stockReady");
    const rows = await api("warehouse", "GET", `/api/v1/warehouse/ledger?warehouseId=${state.warehouse.id}&itemId=${state.item.id}`);
    assert(rows.length > 0);
    assert.equal(rows.reduce((sum, row) => sum + row.signedQuantity, 0), 75);
    const reconciliation = await api("warehouse", "GET", `/api/v1/warehouse/reconciliation?warehouseId=${state.warehouse.id}`);
    assert.equal(reconciliation.filter((row) => row.warehouseId === state.warehouse.id && row.itemId === state.item.id).length, 0, "Sổ kho và tồn có chênh lệch");
  });

  test("XNK-01", "Nhà cung cấp → hợp đồng → lô hàng", async () => {
    need("item");
    state.partner = await create("shipping", "/api/v1/partners", { partnerCode: `${f().prefix}_S`, name: "[E2E] Nhà cung cấp", partnerTypes: ["supplier"] }, "business_partners");
    state.contract = await create("shipping", "/api/v1/import-contracts", { clientRequestId: uuid(), supplierId: state.partner.id, orderDate: today, status: "active", lines: [{ itemId: state.item.id, orderedQuantity: 10, uomId: state.uom.id, unitPrice: 25 }] }, "import_contracts");
    state.shipment = await create("shipping", "/api/v1/shipments", { clientRequestId: uuid(), contractId: state.contract.id, supplierId: state.partner.id, transportMode: "sea", status: "booked", originalEta: today, currentEta: today, lines: [{ itemId: state.item.id, contractLineId: state.contract.lines[0].id, expectedQuantity: 10, uomId: state.uom.id }] }, "shipments");
    assert(state.shipment.lines.length === 1);
  });
  test("XNK-02", "Cập nhật ETA có lịch sử và chặn phiên bản cũ", async () => {
    need("shipment");
    state.shipment = await api("shipping", "POST", `/api/v1/shipments/${state.shipment.id}/update-eta`, { newValue: state.leaveDate || today, source: "forwarder", reason: "E2E hãng tàu cập nhật lịch", rowVersion: state.shipment.rowVersion, clientRequestId: uuid() });
    await conflict("shipping", "POST", `/api/v1/shipments/${state.shipment.id}/update-eta`, { newValue: today, source: "manual", reason: "E2E phiên bản cũ", rowVersion: 1, clientRequestId: uuid() });
  });
  test("XNK-03", "Tiếp nhận một phần, ghi sổ kho và kiểm tra phần còn lại", async () => {
    need("shipment", "warehouse");
    const receipt = await api("shipping", "POST", `/api/v1/shipments/${state.shipment.id}/create-warehouse-receipt`, { clientRequestId: uuid(), warehouseId: state.warehouse.id, receivedDate: today, lines: [{ shipmentLineId: state.shipment.lines[0].id, quantity: 4 }] });
    const documentId = receipt.id || receipt.documentId || receipt.receiptId;
    assert(documentId, `Không có mã phiếu nhận: ${JSON.stringify(receipt)}`);
    await f().track("inventory_documents", documentId);
    await api("warehouse", "POST", `/api/v1/warehouse/receipts/${documentId}/post`, { postingDate: today, idempotencyKey: uuid() });
    const receiving = await api("shipping", "GET", `/api/v1/shipments/${state.shipment.id}/receiving`);
    assert.equal(receiving.lines[0].receivedQuantity, 4);
    assert.equal(receiving.remainingQuantity, 6);
    assert.equal(receiving.status, "partially_received");
  });
  test("XNK-04", "Không nhận vượt số lượng còn lại", async () => {
    need("shipment");
    await invalid("shipping", "POST", `/api/v1/shipments/${state.shipment.id}/create-warehouse-receipt`, { clientRequestId: uuid(), warehouseId: state.warehouse.id, receivedDate: today, lines: [{ shipmentLineId: state.shipment.lines[0].id, quantity: 20 }] });
  });
  test("XNK-05", "Xử lý vướng mắc hải quan rồi thông quan", async () => {
    need("shipment");
    let customs = await api("shipping", "GET", `/api/v1/shipments/${state.shipment.id}/customs`);
    customs = await api("shipping", "PATCH", `/api/v1/shipments/${state.shipment.id}/customs`, { rowVersion: customs.rowVersion, status: "issue", issueNote: "E2E chờ kiểm tra chứng từ", severity: "high" });
    assert.equal(customs.status, "issue");
    customs = await api("shipping", "PATCH", `/api/v1/shipments/${state.shipment.id}/customs`, { rowVersion: customs.rowVersion, status: "cleared", declarationNumber: `${f().prefix}_HQ`, declarationDate: today, clearanceDate: today });
    assert.equal(customs.status, "cleared");
  });
  test("XNK-06", "Nhận nốt 6 hàng và đối chiếu đủ 10 trên sổ nhận/kho", async () => {
    need("shipment");
    const receipt = await create("shipping", `/api/v1/shipments/${state.shipment.id}/create-warehouse-receipt`, { clientRequestId: uuid(), warehouseId: state.warehouse.id, receivedDate: today, lines: [{ shipmentLineId: state.shipment.lines[0].id, quantity: 6 }] }, "inventory_documents");
    await api("warehouse", "POST", `/api/v1/warehouse/receipts/${receipt.id}/post`, { postingDate: today, idempotencyKey: uuid() });
    const receiving = await api("shipping", "GET", `/api/v1/shipments/${state.shipment.id}/receiving`);
    assert.equal(receiving.receivedQuantity, 10); assert.equal(receiving.remainingQuantity, 0); assert.equal(receiving.status, "received");
    await balance(state.warehouse, 85);
  });
  test("WH-09", "Kiểm kê 85 → 83, ghi sổ đúng chênh lệch và chống ghi lại", async () => {
    need("shipment");
    let count = await create("warehouse", "/api/v1/warehouse/stock-counts", { warehouseId: state.warehouse.id, countDate: today, scope: "selected", itemIds: [state.item.id], transactionPolicy: "freeze", note: "E2E kiểm kê cuối kỳ" }, "stock_counts");
    assert.equal(count.lines[0].expectedQuantity, 85);
    count = await api("warehouse", "PATCH", `/api/v1/warehouse/stock-counts/${count.id}`, { rowVersion: count.rowVersion, lines: [{ id: count.lines[0].id, countedQuantity: 83, note: "E2E thiếu hai vật tư" }] });
    const post = { postingDate: today, idempotencyKey: uuid() };
    count = await api("warehouse", "POST", `/api/v1/warehouse/stock-counts/${count.id}/post`, post);
    if (count.adjustmentDocumentId) await f().track("inventory_documents", count.adjustmentDocumentId);
    await balance(state.warehouse, 83);
    await api("warehouse", "POST", `/api/v1/warehouse/stock-counts/${count.id}/post`, post);
    await balance(state.warehouse, 83);
  });

  test("CHAT-01", "Tạo hội thoại riêng, gửi và đọc lại tin nhắn", async () => {
    state.conversation = await create("employee", "/api/v1/chat/conversations", { type: "direct", accountId: person("outsider").accountId }, "conversations");
    state.message = await api("employee", "POST", `/api/v1/chat/conversations/${state.conversation.id}/messages`, { body: `[E2E ${f().manifest.runId}] Bàn giao công việc` });
    const messages = await api("outsider", "GET", `/api/v1/chat/conversations/${state.conversation.id}/messages`);
    assert(JSON.stringify(messages).includes("Bàn giao công việc"));
    await api("outsider", "POST", `/api/v1/chat/conversations/${state.conversation.id}/read`, {});
  });
  test("CHAT-02", "Người ngoài hội thoại không đọc được tin", async () => { need("conversation"); await api("hr", "GET", `/api/v1/chat/conversations/${state.conversation.id}/messages`, undefined, [404]); });
  test("NOTICE-01", "Thông báo chỉ gửi nhóm vai trò E2E, người nhận đọc lại", async () => {
    const role = await f().insert("roles", { code: `e2e_${f().manifest.runId}_notice`, name: "[E2E] Người nhận thông báo" });
    await f().query(f().db.from("account_roles").insert({ account_id: person("employee").accountId, role_id: role.id }), "owned notice role");
    const notice = await create("admin", "/api/v1/system-notices", { title: `${f().prefix} Thông báo`, message: "E2E chỉ gửi tài khoản của lần kiểm thử", startAt: new Date(Date.now() - 60000).toISOString(), endAt: new Date(Date.now() + 3600000).toISOString(), audienceType: "specific_roles", audienceIds: [role.id], priority: "normal", status: "active" }, "system_notices");
    const active = await api("employee", "GET", "/api/v1/system-notices/active");
    assert(active.some((row) => row.id === notice.id));
    const outsider = await api("outsider", "GET", "/api/v1/system-notices/active");
    assert(!outsider.some((row) => row.id === notice.id));
    const notifications = await api("employee", "GET", "/api/v1/notifications");
    assert(JSON.stringify(notifications).includes(f().prefix));
  });
  test("AUDIT-01", "Có audit cho hành động E2E và nhân viên không đọc được audit", async () => {
    const rows = await api("admin", "GET", "/api/v1/audit-log");
    assert(JSON.stringify(rows).includes("E2E"));
    await api("employee", "GET", "/api/v1/audit-log", undefined, [403]);
  });
  test("SESSION-01", "Khóa tài khoản làm phiên cũ mất hiệu lực, mở lại đăng nhập được", async () => {
    await api("admin", "PATCH", `/api/v1/accounts/${person("outsider").accountId}/status`, { status: "disabled", reason: "E2E khóa tài khoản" });
    await api("outsider", "GET", "/api/v1/auth/sessions", undefined, [401]);
    await api("admin", "PATCH", `/api/v1/accounts/${person("outsider").accountId}/status`, { status: "active", reason: "E2E mở lại tài khoản" });
    await api("outsider", "POST", "/api/v1/auth/login", { username: person("outsider").username, password: f().password });
  });
}
