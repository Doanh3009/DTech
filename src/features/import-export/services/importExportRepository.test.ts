import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/features/warehouse/services/warehouseRepository", () => ({ createWarehouseReceiptFromShipment: vi.fn() }));
vi.mock("@/features/shared-platforms/services/notificationRepository", () => ({ publishNotificationEvent: vi.fn() }));

import { shipmentPatchSchema } from "../schemas/importExportSchemas";
import { updateShipment } from "./importExportRepository";

type Row = Record<string, unknown>;
const user: AuthenticatedUser = { id: "11111111-1111-4111-8111-111111111111", email: "operator@example.com", username: "operator", displayName: "XNK", status: "active", permissions: ["shipment.view", "shipment.edit", "import_export.view_all"] };
const shipmentId = "22222222-2222-4222-8222-222222222222";
const supplierId = "33333333-3333-4333-8333-333333333333";
const itemId = "44444444-4444-4444-8444-444444444444";
const uomId = "55555555-5555-4555-8555-555555555555";
const lineId = "66666666-6666-4666-8666-666666666666";

function payload() {
  return shipmentPatchSchema.parse({ supplierId, transportMode: "sea", status: "in_transit", rowVersion: 4, note: "Cập nhật", lines: [{ itemId, uomId, expectedQuantity: 12 }] });
}

function database(options: { error?: { message: string; code?: string }; status?: string; rowVersion?: number; secondLine?: boolean } = {}) {
  const mutations = vi.fn();
  let shipment: Row = { id: shipmentId, shipment_number: "SHP-TEST", supplier_id: supplierId, status: options.status ?? "in_transit", transport_mode: "sea", shipment_type: "import", row_version: options.rowVersion ?? 4, created_by: user.id, shipment_lines: [{ id: lineId, line_number: 1, item_id: itemId, uom_id: uomId, expected_quantity: 10, item_code_snapshot: "I01", item_name_snapshot: "Hàng", row_version: 1 }] };
  if (options.secondLine) (shipment.shipment_lines as Row[]).unshift({ id: "77777777-7777-4777-8777-777777777777", line_number: 2, item_id: itemId, uom_id: uomId, expected_quantity: 20, item_code_snapshot: "I01", item_name_snapshot: "Hàng", row_version: 1 });
  const command = vi.fn(async (name: string, args: Row) => {
    if (options.error) return { data: null, error: options.error };
    mutations({ name, args });
    const lines = args.p_lines as Row[];
    shipment = { ...shipment, ...(args.p_header as Row), row_version: Number(shipment.row_version) + 1, shipment_lines: (shipment.shipment_lines as Row[]).map(row => ({ ...row, ...lines.find(line => line.id === row.id) })) };
    return { data: shipmentId, error: null };
  });
  const client = {
    rpc: command,
    from(table: string) {
      const row = () => table === "app_accounts" ? { id: user.id } : table === "shipments" ? shipment : null;
      const query = {
        select: () => query, eq: () => query, or: () => query, limit: () => query, order: () => query,
        update: () => { throw new Error("Shipment updates must use the atomic command"); },
        single: async () => ({ data: row(), error: null }), maybeSingle: async () => ({ data: row(), error: null }),
        then(resolve: (value: { data: Row[]; error: null }) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); }
      };
      return query;
    }
  };
  getSupabaseServiceClient.mockReturnValue(client);
  return { command, mutations, snapshot: () => shipment };
}

beforeEach(() => getSupabaseServiceClient.mockReset());

describe("shipment atomic save contract", () => {
  it("sends the header and line identities in one command without receiving-view permission", async () => {
    const db = database();
    const result = await updateShipment(user, shipmentId, payload());
    expect(db.command).toHaveBeenCalledExactlyOnceWith("save_shipment_command", expect.objectContaining({ p_shipment_id: shipmentId, p_row_version: 4, p_actor_id: user.id, p_header: expect.objectContaining({ note: "Cập nhật" }), p_lines: [expect.objectContaining({ id: lineId, item_id: itemId, uom_id: uomId, expected_quantity: 12 })] }));
    expect(result).toMatchObject({ rowVersion: 5, note: "Cập nhật", lines: [expect.objectContaining({ expectedQuantity: 12 })] });
  });

  it("does not issue REST writes or claim success when the command reports a line failure", async () => {
    const db = database({ error: { message: "Database line write failed" } });
    await expect(updateShipment(user, shipmentId, payload())).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(db.mutations).not.toHaveBeenCalled();
    expect(db.snapshot()).toMatchObject({ row_version: 4, shipment_lines: [expect.objectContaining({ expected_quantity: 10 })] });
  });

  it("preserves the quantity-change reason rule enforced in the transaction", async () => {
    const db = database({ error: { message: "FIELD_SHIPMENT_QUANTITY_REASON_REQUIRED" } });
    await expect(updateShipment(user, shipmentId, payload())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.mutations).not.toHaveBeenCalled();
  });

  it("rejects a stale version before invoking the command", async () => {
    const db = database({ rowVersion: 5 });
    await expect(updateShipment(user, shipmentId, payload())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.command).not.toHaveBeenCalled();
  });

  it("rejects missing lines instead of leaving stale lines silently", async () => {
    const db = database({ secondLine: true });
    await expect(updateShipment(user, shipmentId, payload())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.command).not.toHaveBeenCalled();
  });

  it("rejects changed item identity instead of ignoring the edit", async () => {
    const db = database();const input = payload();input.lines[0].itemId = "88888888-8888-4888-8888-888888888888";
    await expect(updateShipment(user, shipmentId, input)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(db.command).not.toHaveBeenCalled();
  });

  it("passes line IDs in line-number order even when nested database rows arrive unordered", async () => {
    const db = database({ secondLine: true });const input = payload();input.lines.push({ itemId, uomId, expectedQuantity: 22 });
    await updateShipment(user, shipmentId, input);
    expect(db.command.mock.calls[0][1].p_lines).toMatchObject([{ id: lineId, expected_quantity: 12 }, { id: "77777777-7777-4777-8777-777777777777", expected_quantity: 22 }]);
  });

  it("denies editing without permission before reading the database", async () => {
    await expect(updateShipment({ ...user, permissions: ["shipment.view"] }, shipmentId, payload())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
