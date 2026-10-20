// @vitest-environment node
import nextEnv from "@next/env";
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { allFoundationPermissions } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const session = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: async () => session.user }));

const routeLoaders = import.meta.glob("/src/app/api/v1/**/route.ts") as Record<string, () => Promise<{ GET?: (request: Request) => Promise<Response> }>>;
const paths = [
  "dashboard", "dashboard?scope=global", "employees", "hr/departments", "hr/positions", "hr/contracts", "hr/contract-templates",
  "insurance", "shifts", "timesheet-periods", "timesheet-exceptions", "report-templates",
  "projects", "project-monitoring/summary", "project-monitoring/attention", "project-issues",
  "warehouse/inventory", "warehouse/references", "warehouse/ledger", "warehouse/receipts", "warehouse/issues",
  "warehouse/transfers", "warehouse/stock-counts", "items", "warehouses",
  "import-export/dashboard", "shipments", "import-contracts", "partners",
  "accounting/salaries", "accounting/payroll", "accounting/payroll/references", "accounting/payslips",
  "leave-requests", "leave-balances", "approvals", "documents"
];

describe.skipIf(process.env.RUN_LIVE_READ_AUDIT !== "1")("live Supabase GET route audit (opt-in, read only)", () => {
  const results: Array<{ path: string; status: number; durationMs: number; error?: string }> = [];
  const queryFailures: Array<{ table: string; code: string; message: string }> = [];

  beforeAll(async () => {
    nextEnv.loadEnvConfig(process.cwd());
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
      const response = await originalFetch(...args);
      if (response.status >= 400) {
        const url = new URL(typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url);
        if (url.pathname.startsWith("/rest/v1/")) {
          const body = await response.clone().json().catch(() => ({}));
          queryFailures.push({ table: url.pathname.slice("/rest/v1/".length), code: String(body.code ?? response.status), message: String(body.message ?? "Unknown query failure") });
        }
      }
      return response;
    });
    const client = getSupabaseServiceClient();
    if (!client) throw new Error("Thiếu cấu hình Supabase cho read-only audit.");
    const { data, error } = await client.from("app_accounts")
      .select("id,primary_email,account_roles!account_roles_account_id_fkey(roles(code))").eq("status", "active");
    if (error) throw new Error(`Không thể tra cứu tài khoản vận hành: ${error.code}`);
    const account = data?.find((row) => row.account_roles.some((assignment) => (assignment.roles as unknown as { code?: string })?.code === "admin"));
    if (!account) throw new Error("Không có tài khoản admin active để mô phỏng GET audit.");
    session.user = { id: account.id, email: account.primary_email, username: "read-audit", displayName: "Read audit", status: "active", permissions: allFoundationPermissions };
  }, 30_000);

  afterAll(() => {
    const summary = { routes: results.length, failed: results.filter((result) => result.status >= 400), timings: results.map(({ path, durationMs }) => ({ path, durationMs })), queryFailures };
    console.log(JSON.stringify(summary));
    writeFileSync(process.env.LIVE_READ_AUDIT_OUTPUT || "docs/live-read-audit-2026-10-05.json", JSON.stringify(summary, null, 2));
    vi.restoreAllMocks();
  });

  const selectedPaths = process.env.LIVE_READ_AUDIT_PATHS?.split(",").filter(Boolean);
  it.each(selectedPaths?.length ? paths.filter((path) => selectedPaths.includes(path)) : paths)("loads GET /api/v1/%s", async (path) => {
    const loader = routeLoaders[`/src/app/api/v1/${path.split("?")[0]}/route.ts`];
    expect(loader, `Missing GET route ${path}`).toBeDefined();
    const route = await loader();
    expect(route.GET, `Missing GET handler ${path}`).toBeDefined();
    const start = performance.now();
    const response = await route.GET!(new Request(`http://localhost/api/v1/${path}`));
    const body = await response.json();
    results.push({ path, status: response.status, durationMs: Math.round(performance.now() - start), error: response.ok ? undefined : body.error?.message });
    expect(response.status, `${path}: ${body.error?.message ?? response.status}`).toBe(200);
    if (path.startsWith("dashboard")) {
      const failedWidgets = (body.data?.widgets ?? []).filter((widget: { status: string }) => widget.status === "error").map((widget: { key: string }) => widget.key);
      expect(failedWidgets, "Dashboard widgets failed to load").toEqual([]);
    }
  }, 45_000);
});
