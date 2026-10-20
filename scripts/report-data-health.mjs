import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Thiếu cấu hình Supabase.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ["report_templates", "report_exports", "timesheet_periods", "daily_timesheets", "timesheet_period_summaries", "timesheet_period_versions", "leave_requests", "leave_ledger", "payroll_periods", "payroll_lines"];
const results = await Promise.all(tables.map(async (table) => {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  return { table, count, error: error ? { code: error.code, message: error.message } : null };
}));
const buckets = await client.storage.listBuckets();
const { data: exports, error: exportError } = await client.from("report_exports").select("status,error_message").eq("status", "failed").order("requested_at", { ascending: false }).limit(5);
const { data: templates } = await client.from("report_templates").select("code,name,definition");
const mojibake = /Ã|Ä|á»|áº|Æ|â€|\uFFFD/;
const templateHealth = (templates ?? []).map((template) => ({ code: template.code, invalidUnicode: mojibake.test(JSON.stringify(template)), sheets: template.definition?.sheets?.map((sheet) => sheet.key) ?? [] }));
const { data: completed } = await client.from("report_exports").select("file_assets(bucket,object_path)").eq("status", "completed").limit(5);
const workbookHealth = [];
for (const item of completed ?? []) {
  const asset = Array.isArray(item.file_assets) ? item.file_assets[0] : item.file_assets;
  if (!asset) { workbookHealth.push({ validZip: false, error: "Missing file asset" }); continue; }
  const { data: blob, error } = await client.storage.from(asset.bucket).download(asset.object_path);
  if (error || !blob) { workbookHealth.push({ validZip: false, error: error?.message ?? "Empty file" }); continue; }
  const bytes = Buffer.from(await blob.arrayBuffer());
  const validZip = bytes.subarray(0, 2).toString() === "PK";
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    let invalidUnicodeCells = 0;
    for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => {
      if (typeof cell.value === "string" && mojibake.test(cell.value)) invalidUnicodeCells += 1;
    }));
    workbookHealth.push({ validZip, sheets: workbook.worksheets.length, invalidUnicodeCells });
  } catch { workbookHealth.push({ validZip, error: "Invalid XLSX workbook" }); }
}
console.log(JSON.stringify({ tables: results, reportBucket: buckets.data?.find((bucket) => bucket.id === "report-exports")?.id ?? null, bucketError: buckets.error?.message ?? null, failedExports: exports, exportError: exportError?.message ?? null, templates: templateHealth, storedWorkbooks: workbookHealth }, null, 2));
if (results.some((item) => item.error) || buckets.error) process.exitCode = 1;
