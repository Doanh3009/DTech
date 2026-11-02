// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("@/features/business/businessService", () => ({
  businessSessionArgs: mocks.session, businessRpc: mocks.rpc,
  changeBusinessPassword: vi.fn(), commandBusinessMember: vi.fn(), loginBusiness: vi.fn(),
  logoutBusiness: vi.fn(), readBusinessWorkspace: vi.fn(), saveBusinessRecord: vi.fn()
}));
vi.mock("@/features/business/businessAttachmentService", () => ({ downloadBusinessAttachment: vi.fn(), listBusinessAttachments: vi.fn(), uploadBusinessAttachment: vi.fn() }));
vi.mock("@/features/marketing/trialRequestService", () => ({ readTrialBody: vi.fn() }));
import { GET } from "./route";

const context = () => ({ params: Promise.resolve({ slug: "acme", path: ["misa", "export"] }) });
const request = (query = "view=reports&from=2026-10-01&to=2026-10-31") => new Request(`https://erp.invalid/api/v1/business/acme/misa/export?${query}`);

describe("business MISA export API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ p_hash: "server-session-hash", p_slug: "acme" });
    mocks.rpc.mockResolvedValue({ total: 0, rows: [] });
  });

  it("uses the authenticated tenant for every page and returns a private CSV with allowed columns", async () => {
    const rows = Array.from({ length: 26 }, (_, index) => ({ id: String(index), code: `BC${index}`, name: `Report ${index}`, tenant_id: "hidden-tenant" }));
    mocks.rpc.mockImplementation(async (_name, args) => ({ total: 26, rows: rows.slice((args.p_page - 1) * 25, args.p_page * 25) }));
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain('filename="misa-reports-2026-10-01-2026-10-31.csv"');
    const csv = await response.text();
    expect(csv).toContain('"BC25","Report 25"');
    expect(csv).not.toContain("hidden-tenant");
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith("acme");
    expect(mocks.rpc.mock.calls).toEqual([1, 2].map(page => ["business_misa_snapshot", { p_hash: "server-session-hash", p_slug: "acme", p_view: "reports", p_from: "2026-10-01", p_to: "2026-10-31", p_page: page }]));
  });

  it.each([
    "view=reports&from=2026-02-30&to=2026-03-01",
    "view=reports&from=2026-10-31&to=2026-10-01",
    "view=reports&from=2024-01-01&to=2026-10-31",
    "view=unknown&from=2026-10-01&to=2026-10-31",
    "view=reports&from=2026-10-01&to=2026-10-31&tenant_id=injected"
  ])("rejects invalid export parameters before querying data: %s", async query => {
    expect((await GET(request(query), context())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a business session", async () => {
    mocks.session.mockRejectedValue(new AppError("AUTHENTICATION_REQUIRED"));
    expect((await GET(request(), context())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves report authorization errors without returning data", async () => {
    mocks.rpc.mockRejectedValue(new AppError("PERMISSION_DENIED"));
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("PERMISSION_DENIED");
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  it("returns a recoverable validation error for reports exceeding the row cap", async () => {
    mocks.rpc.mockResolvedValue({ total: 5001, rows: [] });
    const response = await GET(request(), context());
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toContain("5.000");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects overlapping pages rather than downloading duplicate rows", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
    mocks.rpc.mockResolvedValueOnce({ total: 26, rows }).mockResolvedValueOnce({ total: 26, rows: [{ id: "0" }] });
    const response = await GET(request(), context());
    expect(response.status).toBe(409);
    expect(response.headers.get("content-disposition")).toBeNull();
  });
});

describe("item quantity conversion API", () => {
  const itemId = "a3547751-0208-4d79-b136-9194555e868a";
  const params = () => ({ params: Promise.resolve({ slug: "acme", path: ["items", "convert-quantity"] }) });
  const conversionRequest = (query = `itemId=${itemId}&fromUnit=box&quantity=2.5&on=2026-11-02`) => new Request(`https://erp.invalid/api/v1/business/acme/items/convert-quantity?${query}`);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ p_hash: "server-session-hash", p_slug: "acme" });
  });

  it("derives the tenant from the session and delegates the effective date to the conversion RPC", async () => {
    const result = { itemId, baseUnit: "kg", factor: 12, baseQuantity: 30, effectiveOn: "2026-11-02" };
    mocks.rpc.mockResolvedValue(result);
    const response = await GET(conversionRequest(), params());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(result);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("business_item_quantity_conversion", { p_hash: "server-session-hash", p_slug: "acme", p_item_id: itemId, p_from_unit: "box", p_quantity: 2.5, p_on: "2026-11-02" });
  });

  it.each([
    `itemId=${itemId}&fromUnit=box&quantity=0&on=2026-11-02`,
    `itemId=${itemId}&fromUnit=box&quantity=2&on=2026-02-30`,
    `itemId=${itemId}&fromUnit=&quantity=2&on=2026-11-02`,
    `itemId=${itemId}&fromUnit=box&quantity=2&on=2026-11-02&tenant_id=injected`
  ])("rejects invalid conversion input: %s", async query => {
    expect((await GET(conversionRequest(query), params())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns no quantity when the row permission check denies access", async () => {
    mocks.rpc.mockRejectedValue(new AppError("PERMISSION_DENIED"));
    const response = await GET(conversionRequest(), params());
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.data).toBeUndefined();
    expect(body.error.code).toBe("PERMISSION_DENIED");
  });
});
