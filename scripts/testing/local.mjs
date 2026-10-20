import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { createLocalSeed } from "./local-seed.mjs";
const command = process.argv[2];
assert(["start", "status", "reset"].includes(command));
const taskRoot = path.resolve("test-results/local-supabase");
assert(taskRoot.startsWith(path.resolve("test-results") + path.sep), "Local target escaped workspace");
const projectId = "CT_NoiBo_Test";
if (command === "reset") assert(process.argv.includes(`--confirm-local=${projectId}`), `Cần --confirm-local=${projectId}; chỉ reset database Docker riêng`);
const docker = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", windowsHide: true });
assert(docker.status === 0, "Cần cài và mở Docker Desktop để chạy Supabase local riêng");
await mkdir(path.join(taskRoot, "supabase"), { recursive: true });
const config = (await readFile("supabase/config.toml", "utf8")).replace(/project_id = "[^"]+"/, `project_id = "${projectId}"`).replace(/543(\d\d)/g, "553$1");
await writeFile(path.join(taskRoot, "supabase/config.toml"), config);
await cp("supabase/migrations", path.join(taskRoot, "supabase/migrations"), { recursive: true });
const [seed, snapshotMigration] = await Promise.all([
  readFile("supabase/seed.sql", "utf8"),
  readFile("supabase/migrations/202610020001_standardize_employee_access_and_timesheet_exports.sql", "utf8")
]);
await writeFile(path.join(taskRoot, "supabase/seed.sql"), createLocalSeed(seed, snapshotMigration));
const args = command === "reset" ? ["db", "reset", "--local"] : [command];
const child = spawn(process.execPath, ["node_modules/supabase/dist/supabase.js", ...args, "--workdir", taskRoot], { stdio: "inherit", shell: false, windowsHide: true });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
