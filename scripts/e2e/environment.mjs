import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { assertSeedTarget } from "../testing/guard.mjs";
import { loadTestConfiguration, reportTestingError } from "../testing/config.mjs";

async function main() {
  const action = process.argv[2];
  assert(["build", "start", "run", "dev"].includes(action), "Chọn build, start, dev hoặc run");
  const { env, baseUrl } = await loadTestConfiguration();
  if (action !== "run") assert(["localhost", "127.0.0.1"].includes(baseUrl.hostname) && baseUrl.protocol === "http:", "Server build/start/dev E2E cần URL HTTP trên máy local");
  const port = baseUrl.port || "80";
  const args = action === "build" ? ["node_modules/next/dist/bin/next", "build", "--webpack"]
    : action === "start" ? ["node_modules/next/dist/bin/next", "start", "--port", port]
      : ["scripts/e2e/run.mjs", "--allow-remote"];
  await assertSeedTarget(env);
  const commandArgs = action === "dev" ? ["node_modules/next/dist/bin/next", "dev", "--webpack", "--port", port] : args;
  const child = spawn(process.execPath, [...commandArgs, ...process.argv.slice(3)], { env, stdio: "inherit", shell: false, windowsHide: true });
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}

try { await main(); } catch (error) { reportTestingError(error); }
