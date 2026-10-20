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
  throw new Error("Từ chối seed 100 nhân viên trên remote. Chỉ dùng --allow-remote khi đã xác nhận môi trường.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const employeeIds = Array.from({ length: 100 }, (_, index) => `97000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const eventIds = Array.from({ length: 200 }, (_, index) => `97100000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const clientEventIds = Array.from({ length: 200 }, (_, index) => `97200000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

async function run(operation, message) {
  const { error } = await operation;
  if (error) throw new Error(`${message}: ${error.message}`);
}

if (process.argv.includes("--reset")) {
  await run(client.from("attendance_events").delete().in("id", eventIds), "Không thể xóa nhật ký chấm công mẫu");
  await run(client.from("employees").delete().in("id", employeeIds), "Không thể xóa 100 nhân viên mẫu");
  process.stdout.write("Đã xóa 100 nhân viên mẫu và nhật ký chấm công liên quan.\n");
  process.exit(0);
}

const [{ data: location, error: locationError }, { data: department, error: departmentError }, { data: position, error: positionError }, { data: employmentType, error: typeError }] = await Promise.all([
  client.from("attendance_locations").select("id,latitude,longitude").eq("active", true).order("created_at").limit(1).maybeSingle(),
  client.from("departments").select("id").eq("code", "hr").maybeSingle(),
  client.from("positions").select("id").eq("code", "hr_specialist").maybeSingle(),
  client.from("employment_types").select("id").eq("code", "office_employee").maybeSingle()
]);

if (locationError || departmentError || positionError || typeError || !location || !department || !position || !employmentType) {
  throw new Error("Thiếu địa điểm chấm công hoặc dữ liệu tham chiếu để seed 100 nhân viên.");
}

const familyNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Võ", "Đặng", "Bùi", "Đỗ"];
const middleNames = ["Minh", "Thảo", "Gia", "Thanh", "Quốc", "Khánh", "Bảo", "Thu", "Hải", "Ngọc"];
const givenNames = ["Anh", "Bình", "Châu", "Duy", "Giang", "Hà", "Khoa", "Lan", "Nam", "Phương"];
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const atTime = (hour, minute) => `${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`;

const employees = employeeIds.map((id, index) => {
  const number = index + 1;
  const fullName = `${familyNames[index % familyNames.length]} ${middleNames[Math.floor(index / familyNames.length)]} ${givenNames[index % givenNames.length]}`;
  const phone = `090${String(1000000 + number).slice(-7)}`;
  return {
    id,
    employee_code: `DEMO-NV${String(number).padStart(3, "0")}`,
    full_name: fullName,
    display_name: givenNames[index % givenNames.length],
    personal_phone: phone,
    normalized_phone: `84${phone.slice(1)}`,
    company_email: `demo.nv${String(number).padStart(3, "0")}@chautuan.local`,
    department_id: department.id,
    position_id: position.id,
    employment_type_id: employmentType.id,
    join_date: `202${index % 5}-0${(index % 9) + 1}-15`,
    employment_status: "active",
    profile_status: "complete",
    profile_completeness: 100,
    note: "[DEMO DATA] Nhân viên mẫu phục vụ kiểm thử giao diện"
  };
});

await run(client.from("employees").upsert(employees, { onConflict: "id" }), "Không thể seed 100 nhân viên mẫu");

const attendanceEvents = employeeIds.flatMap((employeeId, index) => {
  const checkInMinute = 35 + (index % 25);
  const checkOutMinute = 5 + (index % 35);
  const needsReview = index % 17 === 0;
  return [
    {
      id: eventIds[index * 2],
      client_event_id: clientEventIds[index * 2],
      employee_id: employeeId,
      event_type: "check_in",
      attendance_date: today,
      effective_at: atTime(7, checkInMinute),
      captured_at_client: atTime(7, checkInMinute),
      location_id: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_meters: 8 + (index % 12),
      distance_meters: needsReview ? 180 : 5 + (index % 16),
      geofence_status: needsReview ? "outside" : "valid",
      attendance_status: needsReview ? "needs_review" : "recorded",
      photo_status: needsReview ? "pending_upload" : "uploaded",
      sync_status: needsReview ? "sync_failed" : "synced",
      captured_offline: needsReview,
      device_metadata: { demoData: true, source: "employee-seed" }
    },
    {
      id: eventIds[index * 2 + 1],
      client_event_id: clientEventIds[index * 2 + 1],
      employee_id: employeeId,
      event_type: "check_out",
      attendance_date: today,
      effective_at: atTime(17, checkOutMinute),
      captured_at_client: atTime(17, checkOutMinute),
      location_id: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_meters: 6 + (index % 10),
      distance_meters: 4 + (index % 14),
      geofence_status: "valid",
      attendance_status: "recorded",
      photo_status: "not_required",
      sync_status: "synced",
      captured_offline: false,
      device_metadata: { demoData: true, source: "employee-seed" }
    }
  ];
});

await run(client.from("attendance_events").upsert(attendanceEvents, { onConflict: "id" }), "Không thể seed nhật ký chấm công mẫu");

const [{ count: employeeCount, error: employeeCountError }, { count: eventCount, error: eventCountError }] = await Promise.all([
  client.from("employees").select("id", { count: "exact", head: true }).in("id", employeeIds),
  client.from("attendance_events").select("id", { count: "exact", head: true }).in("id", eventIds)
]);
if (employeeCountError || eventCountError) throw new Error("Không thể xác minh dữ liệu mẫu vừa seed.");
process.stdout.write(`Đã seed ${employeeCount}/100 nhân viên và ${eventCount}/200 nhật ký chấm công mẫu.\n`);
