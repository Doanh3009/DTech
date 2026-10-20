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
  throw new Error("Từ chối seed Auth/storage trên remote. Chỉ dùng --allow-remote khi đã xác nhận môi trường.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const testPassword = process.env.TEST_ACCOUNT_PASSWORD || process.env.SEED_TEST_PASSWORD;
if (!testPassword || testPassword.length < 12) throw new Error("Mật khẩu test phải có tối thiểu 12 ký tự.");
const testUsers = [
  { accountId: "91000000-0000-4000-8000-000000000001", email: "supervisor.test@chautuan.local", name: "Nguyễn Minh Giám Sát" },
  { accountId: "91000000-0000-4000-8000-000000000002", email: "employee.test@chautuan.local", name: "Trần Thu Nhân Viên" },
  { accountId: "91000000-0000-4000-8000-000000000003", email: "payroll.test@chautuan.local", name: "Lê Anh Kế Toán Test" }
];
const files = [
  { id: "98800000-0000-4000-8000-000000000001", bucket: "message-attachments", path: "test-data/98610000-0000-4000-8000-000000000001/preview.png", ownerType: "message", ownerId: "98610000-0000-4000-8000-000000000001", mime: "image/png", kind: "png", name: "anh-tien-do-test.png" },
  { id: "98800000-0000-4000-8000-000000000002", bucket: "attendance-photos", path: "test-data/94000000-0000-4000-8000-000000000001/full.jpg", ownerType: "attendance_event", ownerId: "94000000-0000-4000-8000-000000000001", mime: "image/jpeg", kind: "jpeg", name: "check-in-test.jpg" },
  { id: "98800000-0000-4000-8000-000000000003", bucket: "attendance-photos", path: "test-data/94000000-0000-4000-8000-000000000001/thumb.jpg", ownerType: "attendance_event", ownerId: "94000000-0000-4000-8000-000000000001", mime: "image/jpeg", kind: "jpeg", name: "check-in-test-thumb.jpg" },
  { id: "98800000-0000-4000-8000-000000000004", bucket: "worker-attendance-photos", path: "test-data/95000000-0000-4000-8000-000000000001/full.jpg", ownerType: "worker_attendance_session", ownerId: "95000000-0000-4000-8000-000000000001", mime: "image/jpeg", kind: "jpeg", name: "roster-test.jpg" },
  { id: "98800000-0000-4000-8000-000000000005", bucket: "worker-attendance-photos", path: "test-data/95000000-0000-4000-8000-000000000001/thumb.jpg", ownerType: "worker_attendance_session", ownerId: "95000000-0000-4000-8000-000000000001", mime: "image/jpeg", kind: "jpeg", name: "roster-test-thumb.jpg" }
];

if (process.argv.includes("--reset")) {
  for (const bucket of [...new Set(files.map((file) => file.bucket))]) {
    const paths = files.filter((file) => file.bucket === bucket).map((file) => file.path);
    const { error } = await client.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
  const { data: authUsers, error: authListError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authListError) throw authListError;
  for (const user of authUsers.users.filter((item) => testUsers.some((seed) => seed.email === item.email?.toLowerCase()))) {
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  process.stdout.write("Đã xóa storage test. Chạy supabase/reset-test-data.sql để xóa dữ liệu quan hệ.\n");
  process.exit(0);
}

const { data: listed, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
for (const user of testUsers) {
  let authUser = listed.users.find((item) => item.email?.toLowerCase() === user.email);
  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({ email: user.email, password: testPassword, email_confirm: true, user_metadata: { displayName: user.name, testData: true } });
    if (error || !data.user) throw error ?? new Error(`Không thể tạo auth user ${user.email}`);
    authUser = data.user;
  } else {
    if (authUser.user_metadata?.testData !== true) throw new Error(`Từ chối ghi đè Auth user ngoài phạm vi test: ${user.email}`);
    const { error } = await client.auth.admin.updateUserById(authUser.id, { password: testPassword, email_confirm: true, user_metadata: { displayName: user.name, testData: true } });
    if (error) throw error;
  }
  const { error: linkError } = await client.from("app_accounts").update({ auth_user_id: authUser.id }).eq("id", user.accountId);
  if (linkError) throw linkError;
}

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X9F6WQAAAABJRU5ErkJggg==", "base64");
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAADD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAADD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAADD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAADD/2gAIAQEABj8Cf//Z", "base64");

for (const file of files) {
  const bytes = file.kind === "png" ? png : jpeg;
  const { error: uploadError } = await client.storage.from(file.bucket).upload(file.path, bytes, { contentType: file.mime, upsert: true });
  if (uploadError) throw uploadError;
  const { error: assetError } = await client.from("file_assets").upsert({ id: file.id, bucket: file.bucket, object_path: file.path, owner_entity_type: file.ownerType, owner_entity_id: file.ownerId, mime_type: file.mime, byte_size: bytes.length, visibility: "private", created_by: "91000000-0000-4000-8000-000000000001", metadata: { originalName: file.name, testData: true } }, { onConflict: "id" });
  if (assetError) throw assetError;
}

const operations = [
  client.from("message_attachments").upsert({ id: "98900000-0000-4000-8000-000000000001", conversation_id: "98600000-0000-4000-8000-000000000001", message_id: "98610000-0000-4000-8000-000000000001", file_id: files[0].id }, { onConflict: "id" }),
  client.from("attendance_photos").upsert({ id: "98900000-0000-4000-8000-000000000002", attendance_event_id: "94000000-0000-4000-8000-000000000001", file_id: files[1].id, thumbnail_file_id: files[2].id, captured_at: new Date().toISOString(), width: 1, height: 1, metadata: { testData: true } }, { onConflict: "id" }),
  client.from("worker_attendance_photos").upsert({ id: "98900000-0000-4000-8000-000000000003", session_id: "95000000-0000-4000-8000-000000000001", file_id: files[3].id, thumbnail_file_id: files[4].id, captured_at: new Date().toISOString(), sort_order: 0, width: 1, height: 1, metadata: { testData: true } }, { onConflict: "id" })
];
for (const operation of operations) {
  const { error } = await operation;
  if (error) throw error;
}
process.stdout.write("Seed storage và metadata tệp đã hoàn tất.\n");
