import { assertSeedTarget } from "./testing/guard.mjs";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
await assertSeedTarget();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL và Supabase secret/service-role key là bắt buộc.");

const targetHost = new URL(url).hostname;
const isLocalTarget = targetHost === "127.0.0.1" || targetHost === "localhost";
if (!isLocalTarget && !process.argv.includes("--allow-remote")) {
  throw new Error("Từ chối seed coverage trên remote. Chỉ dùng --allow-remote khi đã xác nhận môi trường.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const actorId = "91000000-0000-4000-8000-000000000001";
const employeeId = "90000000-0000-4000-8000-000000000002";
const payrollEmployeeId = "90000000-0000-4000-8000-000000000003";
const payrollAccountId = "91000000-0000-4000-8000-000000000003";
const payrollRoleCode = "test_payroll_qa";
const workerIds = [
  "41000000-0000-4000-8000-000000000001",
  "41000000-0000-4000-8000-000000000002",
  "41000000-0000-4000-8000-000000000003"
];
const payrollPeriodId = "98400000-0000-4000-8000-000000000001";
const projectId = "b0000000-0000-4000-8000-000000000001";
const worksiteId = "b1000000-0000-4000-8000-000000000001";
const mainWarehouseId = "e3000000-0000-4000-8000-000000000001";
const worksiteWarehouseId = "e3000000-0000-4000-8000-000000000002";
const railItemId = "e2000000-0000-4000-8000-000000000001";
const clampItemId = "e2000000-0000-4000-8000-000000000002";
const helmetItemId = "e2000000-0000-4000-8000-000000000003";
const railUomId = "e0000000-0000-4000-8000-000000000004";
const unitUomId = "e0000000-0000-4000-8000-000000000001";
const shipmentId = "98200000-0000-4000-8000-000000000001";
const shipmentLineId = "98220000-0000-4000-8000-000000000001";

const ids = {
  attendance: [
    "99000000-0000-4000-8000-000000000001",
    "99000000-0000-4000-8000-000000000002",
    "99000000-0000-4000-8000-000000000003",
    "99000000-0000-4000-8000-000000000004"
  ],
  salary: [
    "99010000-0000-4000-8000-000000000001",
    "99010000-0000-4000-8000-000000000002",
    "99010000-0000-4000-8000-000000000003",
    "99010000-0000-4000-8000-000000000004"
  ],
  payrollLines: [
    "99020000-0000-4000-8000-000000000001",
    "99020000-0000-4000-8000-000000000002",
    "99020000-0000-4000-8000-000000000003"
  ],
  progress: ["99030000-0000-4000-8000-000000000001", "99030000-0000-4000-8000-000000000002", "99030000-0000-4000-8000-000000000003"],
  documents: ["99040000-0000-4000-8000-000000000001", "99040000-0000-4000-8000-000000000002"],
  documentLines: ["99050000-0000-4000-8000-000000000001", "99050000-0000-4000-8000-000000000002"],
  stockCount: "99060000-0000-4000-8000-000000000001",
  stockLines: ["99070000-0000-4000-8000-000000000001", "99070000-0000-4000-8000-000000000002"],
  container: "99080000-0000-4000-8000-000000000001",
  schedule: "99090000-0000-4000-8000-000000000001"
};

async function run(operation, message) {
  const { error } = await operation;
  if (error) throw new Error(`${message}: ${error.message}`);
}

if (process.argv.includes("--reset")) {
  await run(client.from("shipment_schedule_history").delete().eq("id", ids.schedule), "Không thể xóa lịch tàu test");
  await run(client.from("shipment_containers").delete().eq("id", ids.container), "Không thể xóa container test");
  await run(client.from("stock_counts").delete().eq("id", ids.stockCount), "Không thể xóa kiểm kê test");
  await run(client.from("inventory_documents").delete().in("id", ids.documents), "Không thể xóa chứng từ kho test");
  await run(client.from("project_progress_nodes").delete().in("id", ids.progress), "Không thể xóa tiến độ test");
  await run(client.from("payroll_lines").delete().in("id", ids.payrollLines), "Không thể xóa dòng lương test");
  await run(client.from("employee_salary_history").delete().in("id", ids.salary), "Không thể xóa lịch sử lương test");
  await run(client.from("attendance_events").delete().in("id", ids.attendance), "Không thể xóa chấm công test");
  await run(client.from("account_roles").delete().eq("account_id", payrollAccountId), "Không thể xóa role tài khoản test");
  await run(client.from("app_accounts").delete().eq("id", payrollAccountId), "Không thể xóa tài khoản test");
  await run(client.from("employees").delete().eq("id", payrollEmployeeId), "Không thể xóa nhân viên test");
  await run(client.from("roles").delete().eq("code", payrollRoleCode), "Không thể xóa role payroll test");
  process.stdout.write("Đã xóa seed coverage TEST.\n");
  process.exit(0);
}

const { data: location, error: locationError } = await client
  .from("attendance_locations")
  .select("id,latitude,longitude")
  .eq("active", true)
  .order("created_at")
  .limit(1)
  .maybeSingle();
if (locationError || !location) throw new Error("Không có location chấm công active để seed coverage.");

const [{ data: accountingDepartment, error: departmentError }, { data: accountantPosition, error: positionError }, { data: officeType, error: typeError }] = await Promise.all([
  client.from("departments").select("id").eq("code", "accounting").maybeSingle(),
  client.from("positions").select("id").eq("code", "accountant").maybeSingle(),
  client.from("employment_types").select("id").eq("code", "office_employee").maybeSingle()
]);
if (departmentError || positionError || typeError || !accountingDepartment || !accountantPosition || !officeType) {
  throw new Error("Thiếu dữ liệu tham chiếu để tạo tài khoản payroll test.");
}
await run(client.from("roles").upsert({ code: payrollRoleCode, name: "[TEST] Payroll QA", description: "Quyền tối thiểu để kiểm tra bảng lương và chat overlay.", is_system: false }, { onConflict: "code" }), "Không thể seed role payroll test");
const { data: payrollRole, error: payrollRoleError } = await client.from("roles").select("id").eq("code", payrollRoleCode).maybeSingle();
if (payrollRoleError || !payrollRole) throw new Error("Không thể đọc role payroll test.");
const { data: permissionRows, error: permissionError } = await client.from("permissions").select("key").in("key", ["payroll.view", "payroll.edit", "chat.access"]);
if (permissionError || (permissionRows ?? []).length !== 3) throw new Error("Thiếu permission tối thiểu cho role payroll test.");
await run(client.from("role_permissions").upsert(permissionRows.map((permission) => ({ role_id: payrollRole.id, permission_key: permission.key })), { onConflict: "role_id,permission_key" }), "Không thể gán permission payroll test");
await run(client.from("employees").upsert({ id: payrollEmployeeId, employee_code: "TEST-KT01", full_name: "Lê Anh Kế Toán Test", display_name: "Kế Toán Test", personal_phone: "0909000003", normalized_phone: "84909000003", company_email: "payroll.test@chautuan.local", department_id: accountingDepartment.id, position_id: accountantPosition.id, employment_type_id: officeType.id, join_date: "2026-01-01", employment_status: "active", profile_status: "complete", profile_completeness: 100, note: "[TEST DATA] Tài khoản kiểm thử bảng lương" }, { onConflict: "id" }), "Không thể seed nhân viên payroll test");
await run(client.from("app_accounts").upsert({ id: payrollAccountId, employee_id: payrollEmployeeId, display_name: "Lê Anh Kế Toán Test", primary_email: "payroll.test@chautuan.local", status: "active", username: "test.payroll", metadata: { testData: true } }, { onConflict: "id" }), "Không thể seed tài khoản payroll test");
await run(client.from("account_roles").upsert({ account_id: payrollAccountId, role_id: payrollRole.id, assigned_by: actorId }, { onConflict: "account_id,role_id" }), "Không thể gán role payroll test");

const today = new Date();
const day = (offset) => {
  const value = new Date(today);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};
const timestamp = (offset, time) => `${day(offset)}T${time}:00+07:00`;

await Promise.all([
  run(client.from("attendance_events").upsert([
    { id: ids.attendance[0], client_event_id: "99100000-0000-4000-8000-000000000001", employee_id: employeeId, account_id: "91000000-0000-4000-8000-000000000002", event_type: "check_in", attendance_date: day(-2), effective_at: timestamp(-2, "08:11"), captured_at_client: timestamp(-2, "08:11"), location_id: location.id, latitude: location.latitude, longitude: location.longitude, accuracy_meters: 14, distance_meters: 11, geofence_status: "valid", attendance_status: "recorded", photo_status: "uploaded", sync_status: "synced", captured_offline: false, device_metadata: { testData: true, device: "coverage-seed", lateMinutes: 11 } },
    { id: ids.attendance[1], client_event_id: "99100000-0000-4000-8000-000000000002", employee_id: employeeId, account_id: "91000000-0000-4000-8000-000000000002", event_type: "check_out", attendance_date: day(-2), effective_at: timestamp(-2, "17:02"), captured_at_client: timestamp(-2, "17:02"), location_id: location.id, latitude: location.latitude, longitude: location.longitude, accuracy_meters: 11, distance_meters: 9, geofence_status: "valid", attendance_status: "recorded", photo_status: "not_required", sync_status: "synced", captured_offline: false, device_metadata: { testData: true, device: "coverage-seed" } },
    { id: ids.attendance[2], client_event_id: "99100000-0000-4000-8000-000000000003", employee_id: employeeId, account_id: "91000000-0000-4000-8000-000000000002", event_type: "check_in", attendance_date: day(-1), effective_at: timestamp(-1, "07:49"), captured_at_client: timestamp(-1, "07:49"), location_id: location.id, latitude: location.latitude, longitude: location.longitude, accuracy_meters: 18, distance_meters: 250, geofence_status: "outside", attendance_status: "needs_review", photo_status: "pending_upload", sync_status: "sync_failed", captured_offline: true, device_metadata: { testData: true, device: "coverage-seed" } },
    { id: ids.attendance[3], client_event_id: "99100000-0000-4000-8000-000000000004", employee_id: employeeId, account_id: "91000000-0000-4000-8000-000000000002", event_type: "check_out", attendance_date: day(-1), effective_at: timestamp(-1, "17:12"), captured_at_client: timestamp(-1, "17:12"), location_id: location.id, latitude: location.latitude, longitude: location.longitude, accuracy_meters: 10, distance_meters: 8, geofence_status: "valid", attendance_status: "recorded", photo_status: "not_required", sync_status: "synced", captured_offline: false, device_metadata: { testData: true, device: "coverage-seed" } }
  ], { onConflict: "id" }), "Không thể seed attendance coverage"),
  run(client.from("employee_salary_history").upsert([
    { id: ids.salary[0], employee_id: employeeId, base_salary: 18000000, allowance: 1200000, bonus: 500000, deduction: 300000, effective_date: day(-60), note: "[TEST DATA] Lương nhân viên văn phòng", reason: "Seed coverage", changed_by: actorId },
    { id: ids.salary[1], employee_id: workerIds[0], base_salary: 11200000, allowance: 650000, bonus: 250000, deduction: 100000, effective_date: day(-60), note: "[TEST DATA] Lương công nhân ca ngày", reason: "Seed coverage", changed_by: actorId },
    { id: ids.salary[2], employee_id: workerIds[1], base_salary: 11800000, allowance: 700000, bonus: 0, deduction: 150000, effective_date: day(-60), note: "[TEST DATA] Lương công nhân tăng ca", reason: "Seed coverage", changed_by: actorId },
    { id: ids.salary[3], employee_id: workerIds[2], base_salary: 10500000, allowance: 500000, bonus: 400000, deduction: 0, effective_date: day(-60), note: "[TEST DATA] Lương công nhân an toàn", reason: "Seed coverage", changed_by: actorId }
  ], { onConflict: "id" }), "Không thể seed lịch sử lương coverage"),
  run(client.from("payroll_lines").upsert([
    { id: ids.payrollLines[0], payroll_period_id: payrollPeriodId, employee_id: workerIds[0], work_days: 22, base_salary: 11200000, allowance: 650000, bonus: 250000, deduction: 100000, calculation_snapshot: { testData: true, scenario: "full-work" } },
    { id: ids.payrollLines[1], payroll_period_id: payrollPeriodId, employee_id: workerIds[1], work_days: 20.5, base_salary: 11800000, allowance: 700000, bonus: 0, deduction: 150000, calculation_snapshot: { testData: true, scenario: "leave-half-day" } },
    { id: ids.payrollLines[2], payroll_period_id: payrollPeriodId, employee_id: workerIds[2], work_days: 21, base_salary: 10500000, allowance: 500000, bonus: 400000, deduction: 0, calculation_snapshot: { testData: true, scenario: "safety-bonus" } }
  ], { onConflict: "id", ignoreDuplicates: true }), "Không thể seed dòng lương coverage"),
  run(client.from("project_progress_nodes").upsert([
    { id: ids.progress[0], project_id: projectId, parent_id: null, node_type: "phase", name: "[TEST DATA] Chuẩn bị vật tư", status: "completed", completion_percent: 100, deadline: day(-2), sort_order: 10, created_by: actorId },
    { id: ids.progress[1], project_id: projectId, parent_id: null, node_type: "phase", name: "[TEST DATA] Thi công QC03", status: "in_progress", completion_percent: 62, deadline: day(5), assignee_employee_id: workerIds[0], sort_order: 20, created_by: actorId },
    { id: ids.progress[2], project_id: projectId, parent_id: ids.progress[1], node_type: "task", name: "[TEST DATA] Kiểm tra siết kẹp ray", status: "blocked", completion_percent: 35, deadline: day(1), assignee_employee_id: workerIds[1], sort_order: 10, created_by: actorId }
  ], { onConflict: "id" }), "Không thể seed tiến độ dự án coverage"),
  run(client.from("shipment_containers").upsert({ id: ids.container, shipment_id: shipmentId, container_number: "TESTU-20260919", seal_number: "TEST-SEAL-19", container_type: "GP", size: "40HC", gross_weight: 14200, tare_weight: 3800, status: "arrived", note: "[TEST DATA] Container đã cập cảng" }, { onConflict: "id" }), "Không thể seed container coverage"),
  run(client.from("shipment_schedule_history").upsert({ id: ids.schedule, shipment_id: shipmentId, schedule_type: "eta", old_value: day(1), new_value: day(2), reason: "[TEST DATA] Điều chỉnh lịch tàu để kiểm thử attention", source: "carrier", client_request_id: "99100000-0000-4000-8000-000000000005", changed_by: actorId }, { onConflict: "id" }), "Không thể seed lịch tàu coverage")
]);

await run(client.from("shipment_line_container_allocations").upsert({ shipment_line_id: shipmentLineId, container_id: ids.container, quantity: 60 }, { onConflict: "shipment_line_id,container_id" }), "Không thể seed phân bổ container coverage");
await run(client.from("inventory_documents").upsert([
  { id: ids.documents[0], client_request_id: "99110000-0000-4000-8000-000000000001", document_number: "TEST-PXK-0002", type: "issue", status: "submitted", document_date: day(-1), source_warehouse_id: mainWarehouseId, transaction_type_code: "PROJECT", project_id: projectId, worksite_id: worksiteId, recipient: "Đội QC03", note: "[TEST DATA] Xuất vật tư cho công trường", created_by: actorId, submitted_by: actorId, submitted_at: timestamp(-1, "09:00") },
  { id: ids.documents[1], client_request_id: "99110000-0000-4000-8000-000000000002", document_number: "TEST-CK-0001", type: "transfer", status: "draft", document_date: day(0), source_warehouse_id: mainWarehouseId, target_warehouse_id: worksiteWarehouseId, transaction_type_code: "WAREHOUSE_TRANSFER", project_id: projectId, worksite_id: worksiteId, note: "[TEST DATA] Chuyển kho chờ duyệt", created_by: actorId }
], { onConflict: "id", ignoreDuplicates: true }), "Không thể seed chứng từ kho coverage");
await run(client.from("inventory_document_lines").upsert([
  { id: ids.documentLines[0], document_id: ids.documents[0], line_number: 1, item_id: clampItemId, quantity: 24, uom_id: unitUomId, unit_price: 125000, purpose: "Thi công QC03", reference: "[TEST DATA]" },
  { id: ids.documentLines[1], document_id: ids.documents[1], line_number: 1, item_id: helmetItemId, quantity: 12, uom_id: unitUomId, unit_price: 180000, purpose: "Điều chuyển bảo hộ", reference: "[TEST DATA]" }
], { onConflict: "id", ignoreDuplicates: true }), "Không thể seed dòng chứng từ kho coverage");
await run(client.from("stock_counts").upsert({ id: ids.stockCount, count_number: "TEST-KK-0001", warehouse_id: mainWarehouseId, count_date: day(-1), snapshot_at: timestamp(-1, "18:00"), scope: "selected", transaction_policy: "reconcile", status: "reviewed", note: "[TEST DATA] Kiểm kê có chênh lệch để review", created_by: actorId, reviewed_by: actorId, reviewed_at: timestamp(-1, "18:30") }, { onConflict: "id", ignoreDuplicates: true }), "Không thể seed kiểm kê coverage");
await run(client.from("stock_count_lines").upsert([
  { id: ids.stockLines[0], stock_count_id: ids.stockCount, item_id: railItemId, uom_id: railUomId, expected_quantity: 8, counted_quantity: 7, note: "[TEST DATA] Thiếu một thanh ray" },
  { id: ids.stockLines[1], stock_count_id: ids.stockCount, item_id: clampItemId, uom_id: unitUomId, expected_quantity: 42, counted_quantity: 45, note: "[TEST DATA] Thừa ba kẹp ray" }
], { onConflict: "id", ignoreDuplicates: true }), "Không thể seed dòng kiểm kê coverage");

process.stdout.write("Seed coverage TEST đã hoàn tất.\n");
