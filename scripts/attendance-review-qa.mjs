import { getTestPassword } from "./testing/password.mjs";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: photos, error } = await db.from("attendance_photos").select("id,attendance_event_id,file_assets!attendance_photos_file_id_fkey(bucket,object_path)").limit(1);
if (error || !photos?.[0]) throw new Error(error ? `Attendance photo read: ${error.code} ${error.message}` : "QA needs an existing attendance photo.");
const photo = photos[0];
const asset = photo.file_assets;
const { data: imageData, error: imageError } = await db.storage.from(asset.bucket).download(asset.object_path);
if (imageError || !imageData) throw new Error("Existing attendance evidence cannot be downloaded.");
const imageBytes = Buffer.from(await imageData.arrayBuffer());
const output = path.join(process.cwd(), "docs", "ui-evidence", "attendance-review");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.UI_QA_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true, args: ["--use-fake-device-for-media-stream"] });
const report = [];

function makeDay(date) {
  const event = (id, eventType, clock, uploaded) => ({ id, clientEventId: id, employeeId: "employee-preview-1", eventType, attendanceDate: date, effectiveAt: `${date}T${clock}:00+07:00`, capturedAtClient: `${date}T${clock}:00+07:00`, receivedAtServer: `${date}T${clock}:00+07:00`, photoId: uploaded ? photo.id : undefined, photoStatus: uploaded ? "uploaded" : "pending_upload", syncStatus: uploaded ? "synced" : "syncing", geofenceStatus: "valid", attendanceStatus: "recorded", latitude: 10.7769, longitude: 106.7009, accuracyMeters: 15, anomalyFlags: [] });
  const employee = (number, name, status, events) => ({ employeeId: `employee-preview-${number}`, employeeCode: `NV0${number}`, employeeName: name, departmentId: number > 2 ? "engineering" : "hr", departmentName: number > 2 ? "Kỹ thuật" : "Nhân sự", shiftId: "shift-1", shiftName: "Ca hành chính", checkIn: events.find((event) => event.eventType === "check_in")?.effectiveAt, checkOut: events.find((event) => event.eventType === "check_out")?.effectiveAt, lateMinutes: status === "late" ? 10 : 0, earlyLeaveMinutes: 0, totalMinutes: events.length > 1 ? 540 : 0, status, events });
  const rows = [employee(1, "Nguyễn Văn An", "present", [event("in", "check_in", "08:00", true), event("out", "check_out", "17:00", true)]), employee(2, "Trần Thị Bình", "late", [event("pending", "check_in", "08:15", false)]), employee(3, "Lê Văn Cường", "not_checked", []), employee(4, "Phạm Thị Dung", "leave", [])];
  return { date, totalEmployees: 4, present: 2, late: 1, leave: 1, notChecked: 1, missingCheck: 0, canViewPhotos: true, rows };
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: "vi-VN" });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.route("**/api/v1/attendance/admin/today?*", async (route) => route.fulfill({ json: { data: makeDay(new URL(route.request().url()).searchParams.get("date")) } }));
    await page.route("**/api/v1/attendance/photos/**", async (route) => route.fulfill({ body: imageBytes, contentType: imageData.type || "image/webp" }));
    await page.goto(`${baseUrl}/ui-preview/attendance`, { waitUntil: "networkidle" });
    const thumbnail = page.getByRole("button", { name: "Xem ảnh chấm vào của Nguyễn Văn An lúc 08:00" });
    await thumbnail.waitFor();
    await thumbnail.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll("button img")].every((image) => image.complete && image.naturalWidth > 0));
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, thumbnails: document.querySelectorAll("button img").length }));
    if (dimensions.content > dimensions.viewport) throw new Error(`Attendance overflow ${dimensions.content}/${dimensions.viewport}`);
    await page.screenshot({ path: path.join(output, `review-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await thumbnail.click();
    await page.getByRole("dialog", { name: "Nguyễn Văn An · Chấm vào" }).waitFor();
    await page.getByRole("button", { name: "Ảnh sau" }).click();
    await page.getByRole("dialog", { name: "Nguyễn Văn An · Chấm ra" }).waitFor();
    await page.screenshot({ path: path.join(output, `evidence-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await page.getByLabel("Ngày", { exact: true }).fill("2026-09-30");
    await page.waitForResponse((response) => response.url().includes("attendance/admin/today?date=2026-09-30"));
    await page.getByLabel("Nhân viên", { exact: true }).fill("NV02");
    await page.getByText("Trần Thị Bình", { exact: true }).first().waitFor();
    if (await page.getByText("Nguyễn Văn An", { exact: true }).count()) throw new Error("Employee filter failed.");
    if (failures.length) throw new Error(failures.join("; "));
    report.push({ viewport, dimensions, realStorageImage: true, isolatedDataFixture: true, photoNavigation: true, dateFilter: true, employeeFilter: true, runtimeErrors: failures });
    console.log(`PASS attendance review ${viewport.width}x${viewport.height}: real image, photo navigation, date and employee filters, no overflow`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN", permissions: ["camera", "geolocation"], geolocation: { latitude: 21.0278, longitude: 105.8342, accuracy: 20 } });
  const login = await context.request.post(`${baseUrl}/api/v1/auth/login`, { data: { username: "test.employee", password: getTestPassword() } });
  if (!login.ok()) throw new Error(`Disposable employee login failed: ${login.status()}`);
  const page = await context.newPage();
  await page.route("**/api/v1/attendance/dashboard", async (route) => {
    const original = await route.fetch();
    const body = await original.json();
    await route.fulfill({ json: { ...body, data: { ...body.data, nextAction: "check_in", todayEvents: [] } } });
  });
  await page.goto(`${baseUrl}/attendance/quick`, { waitUntil: "networkidle" });
  await page.getByText("21.02780, 105.83420 · ±20 m", { exact: true }).waitFor();
  const takePhoto = page.getByRole("button", { name: "Chụp ảnh", exact: true });
  await takePhoto.waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Chụp ảnh"]').disabled);
  await takePhoto.click();
  await page.getByRole("button", { name: "Sử dụng ảnh", exact: true }).waitFor();
  if (!await page.getByRole("button", { name: "Sử dụng ảnh", exact: true }).isEnabled()) throw new Error("Outside-radius GPS still blocked.");
  await page.screenshot({ path: path.join(output, "gps-anywhere-390x844.png"), fullPage: true });
  // No submit click: this QA never inserts attendance in the live database.
  await context.clearPermissions();
  await page.getByRole("button", { name: "Thử lại GPS", exact: true }).click();
  await page.getByText("Chưa có quyền vị trí. Bật quyền vị trí cho trang này trong trình duyệt.", { exact: true }).waitFor();
  if (await page.getByRole("button", { name: "Sử dụng ảnh", exact: true }).isEnabled()) throw new Error("Missing required GPS was accepted.");
  report.push({ employeeGps: { anywhereCoordinates: true, photoReadyOutsideRadius: true, deniedPermissionVisible: true, noDatabaseWrites: true } });
  console.log("PASS employee GPS: outside-radius capture enabled, denied permission explicit, no attendance submitted");
  await context.close();
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
