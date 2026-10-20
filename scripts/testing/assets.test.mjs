// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { seedAsset } from "./assets.mjs";
const input = { id: "unit-asset", bucket: "project-update-files", path: "test-platform/unit/report.png", ownerType: "project_update", ownerId: "unit-report", mime: "image/png", bytes: Buffer.from("unit-fixture"), actor: "unit-account" };
function database(old = null, files = []) {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null }), upload = vi.fn().mockResolvedValue({ error: null });
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: old, error: null }), upsert };
  return { from: () => query, storage: { from: () => ({ list: async () => ({ data: files, error: null }), upload }) }, upsert, upload };
}
describe("private test file ownership", () => {
  it("refuses existing unowned metadata before uploading", async () => {
    const db = database({ metadata: {} });
    await expect(seedAsset(db, input)).rejects.toThrow("ngoài phạm vi");
    expect(db.upload).not.toHaveBeenCalled(); expect(db.upsert).not.toHaveBeenCalled();
  });
  it("refuses overwriting an untracked storage object", async () => {
    const db = database(null, [{ name: "report.png" }]);
    await expect(seedAsset(db, input)).rejects.toThrow("chưa được");
    expect(db.upload).not.toHaveBeenCalled();
  });
  it("creates private metadata and uploads a new object without overwrite", async () => {
    const db = database(); await seedAsset(db, input);
    expect(db.upload).toHaveBeenCalledWith(input.path, input.bytes, { contentType: "image/png", upsert: false });
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private", owner_entity_id: input.ownerId, byte_size: input.bytes.length, metadata: expect.objectContaining({ testOwner: "ct-noibo-test-v1" }) }), { onConflict: "id" });
  });
  it("can repeat the upload only for the exact owned record and object", async () => {
    const old = { bucket: input.bucket, object_path: input.path, owner_entity_type: input.ownerType, owner_entity_id: input.ownerId, metadata: { testOwner: "ct-noibo-test-v1" } };
    const db = database(old, [{ name: "report.png" }]); await seedAsset(db, input);
    expect(db.upload).toHaveBeenCalledWith(input.path, input.bytes, { contentType: "image/png", upsert: true });
    await expect(seedAsset(database({ ...old, owner_entity_id: "other" }), input)).rejects.toThrow();
  });
});
