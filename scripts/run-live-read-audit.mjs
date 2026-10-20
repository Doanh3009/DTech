import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "src/testing/liveReadRoutes.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, RUN_LIVE_READ_AUDIT: "1", LIVE_READ_AUDIT_PATHS: process.argv.slice(2).join(",") }
});
process.exit(result.status ?? 1);
