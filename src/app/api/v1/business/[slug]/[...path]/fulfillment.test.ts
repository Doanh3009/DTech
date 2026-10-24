import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/api/errors";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), session: vi.fn() }));
vi.mock("@/features/business/businessService", () => ({
 businessRpc: mock.rpc, businessSessionArgs: mock.session,
 changeBusinessPassword: vi.fn(), loginBusiness: vi.fn(), logoutBusiness: vi.fn(), readBusinessWorkspace: vi.fn(), saveBusinessRecord: vi.fn()
}));
vi.mock("@/features/business/businessCredentials", () => ({ businessHash: vi.fn() }));
import { GET, POST } from "./route";
const orderId = "10000000-0000-4000-8000-000000000001";
const itemId = "10000000-0000-4000-8000-000000000002";
const warehouseId = "10000000-0000-4000-8000-000000000003";
const command = { requestId: orderId, rowVersion: 2, documentDate: "2026-10-23", lines: [{ itemId, warehouseId, lotId: null, quantity: 2, unitCost: 0 }] };
const context = (suffix: string) => ({ params: Promise.resolve({ slug: "acme", path: ["sales-orders", orderId, suffix] }) });
const request = (body: unknown) => new Request("http://localhost/api/v1/business/acme/sales-orders/" + orderId + "/deliveries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mock.session.mockResolvedValue({ p_hash: "derived-session", p_slug: "acme" }); mock.rpc.mockResolvedValue({ orderId, rowVersion: 3, stockMoveIds: [itemId] }); });
describe("tenant sales fulfillment endpoints", () => {
 it("passes only the authenticated session and route order to the read command", async () => {
  const response = await GET(new Request("http://localhost/api?tenant_id=forged"), context("fulfillment"));
  expect(response.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("business_sales_fulfillment", { p_hash: "derived-session", p_slug: "acme", p_order_id: orderId });
  expect(response.headers.get("cache-control")).toBe("no-store");
 });
 it("sends the entire delivery as one tenant-scoped command", async () => {
  const response = await POST(request(command), context("deliveries"));
  expect(response.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledOnce();
  expect(mock.rpc).toHaveBeenCalledWith("business_deliver_sales_order", { p_hash: "derived-session", p_slug: "acme", p_order_id: orderId, p_request_id: command.requestId, p_expected_version: 2, p_document_date: command.documentDate, p_lines: command.lines });
 });
 it("rejects caller-supplied tenant/account fields before issuing a command", async () => {
  expect((await POST(request({ ...command, tenantId: orderId, accountId: itemId }), context("deliveries"))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
 it("does not call the database command without a valid business session", async () => {
  mock.session.mockRejectedValue(new AppError("AUTHENTICATION_REQUIRED"));
  expect((await POST(request(command), context("deliveries"))).status).toBe(401);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
});
