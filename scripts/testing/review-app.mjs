import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const action = process.argv[2];
assert(["build", "start"].includes(action));
const args = action === "build" ? ["build", "--webpack"] : ["start", "--port", "3400"];
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { env: { ...process.env, BUILD_VARIANT: "review", APP_ENV: "production", RELEASE_ENVIRONMENT: "production", TEST_TOOLS_ENABLED: "false" }, stdio: "inherit", shell: false, windowsHide: true });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
