import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fixedId, check } from "./accounts.mjs";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";

export async function seedAsset(db, { id, bucket, path, ownerType, ownerId, mime, bytes, actor }) {
  const old = await check(db.from("file_assets").select("bucket,object_path,owner_entity_type,owner_entity_id,metadata").eq("id", id).maybeSingle(), "asset ownership");
  assert(!old || (old.metadata?.testOwner === TEST_OWNER && old.bucket === bucket && old.object_path === path && old.owner_entity_type === ownerType && old.owner_entity_id === ownerId), "Không ghi đè file ngoài phạm vi test");
  const name = path.split("/").at(-1), directory = path.slice(0, -(name.length + 1));
  const { data: files, error } = await db.storage.from(bucket).list(directory, { search: name });
  assert(!error, `Storage preflight: ${error?.message}`);
  assert(old || !files.some((file) => file.name === name), "Không ghi đè object chưa được bộ seed quản lý");
  const uploaded = await db.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: Boolean(old) });
  assert(!uploaded.error, `Upload fixture: ${uploaded.error?.message}`);
  await check(db.from("file_assets").upsert({ id, bucket, object_path: path, owner_entity_type: ownerType, owner_entity_id: ownerId, mime_type: mime, byte_size: bytes.length, visibility: "private", created_by: actor, checksum: createHash("sha256").update(bytes).digest("hex"), metadata: { testOwner: TEST_OWNER, testData: true, originalName: name } }, { onConflict: "id" }), "seed owned file");
}
export async function seedFieldPhoto(db, name, updateId, actor) {
  const fileId = fixedId(`field-photo:${name}`), id = fixedId(`field-attachment:${name}`);
  const old = await check(db.from("project_update_attachments").select("update_id,file_id").eq("id", id).maybeSingle(), "photo link ownership");
  assert(!old || (old.update_id === updateId && old.file_id === fileId), "Attachment ID collision");
  await seedAsset(db, { id: fileId, bucket: "project-update-files", path: `test-platform/${TEST_OWNER}/projects/${name}/field-report.png`, ownerType: "project_update", ownerId: updateId, mime: "image/png", bytes: await readFile(new URL("./fixtures/mock-field-report.png", import.meta.url)), actor });
  await check(db.from("project_update_attachments").upsert({ id, update_id: updateId, file_id: fileId, attachment_type: "image", caption: "[TEST] Minh họa công trường hư cấu", uploaded_by: actor }, { onConflict: "id" }), "link field photo");
}
export async function seedShipmentDocuments(db) {
  const shipmentId = "98200000-0000-4000-8000-000000000001", actor = fixedId("account:admin.test");
  const shipment = await check(db.from("shipments").select("shipment_number,note").eq("id", shipmentId).single(), "base TEST shipment");
  assert(shipment.shipment_number.startsWith("TEST-") && shipment.note?.includes("[TEST DATA]"), "Không thêm chứng từ vào lô hàng ngoài test");
  for (const code of ["COMMERCIAL_INVOICE", "PACKING_LIST", "BILL_OF_LADING", "CERTIFICATE_OF_ORIGIN"]) {
    const type = await check(db.from("shipment_document_types").select("id").eq("code", code).single(), code);
    const id = fixedId(`shipment-document:${code}`), fileId = fixedId(`shipment-document-file:${code}`);
    const old = await check(db.from("shipment_documents").select("shipment_id,file_id,note").eq("id", id).maybeSingle(), "document ownership");
    assert(!old || (old.shipment_id === shipmentId && old.file_id === fileId && old.note === `[TEST:${TEST_OWNER}]`), "Document ID collision");
    if (old) continue; // Keep document replacements and archived history.
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    page.drawText("CT NOIBO - TEST DOCUMENT", { x: 48, y: 770, size: 24, font, color: rgb(0.1, 0.45, 0.75) });
    page.drawText(code, { x: 48, y: 720, size: 18, font });
    page.drawText("FAKE DATA / NO COMMERCIAL OR LEGAL VALUE", { x: 48, y: 680, size: 12, font });
    const bytes = Buffer.from(await pdf.save());
    await seedAsset(db, { id: fileId, bucket: "shipment-documents", path: `test-platform/${TEST_OWNER}/shipments/${code}.pdf`, ownerType: "shipment", ownerId: shipmentId, mime: "application/pdf", bytes, actor });
    await check(db.from("shipment_documents").insert({ id, shipment_id: shipmentId, document_type_id: type.id, document_number: `QA-${code}`, issuer: "[TEST] Fake issuer", file_id: fileId, status: "valid", note: `[TEST:${TEST_OWNER}]`, uploaded_by: actor }), "seed shipment document");
  }
  console.log("READY 4 chứng từ PDF XNK hư cấu trong private storage");
}
export async function verifySeedFiles(db) {
  const ids = ["A", "B"].map((name) => fixedId(`field-photo:${name}`)).concat(["COMMERCIAL_INVOICE", "PACKING_LIST", "BILL_OF_LADING", "CERTIFICATE_OF_ORIGIN"].map((code) => fixedId(`shipment-document-file:${code}`)));
  const files = await check(db.from("file_assets").select("id,bucket,object_path,mime_type,byte_size,checksum,visibility,metadata").in("id", ids), "verify seed files");
  assert.equal(files.length, ids.length);
  for (const file of files) {
    assert(file.metadata?.testOwner === TEST_OWNER && file.visibility === "private", "File chưa có ownership/private policy");
    const { data, error } = await db.storage.from(file.bucket).download(file.object_path);
    assert(!error && data, "Thiếu storage object của fixture");
    const bytes = Buffer.from(await data.arrayBuffer());
    assert.equal(bytes.length, Number(file.byte_size));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.checksum);
    assert(file.mime_type === "image/png" ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" : bytes.subarray(0, 4).toString() === "%PDF", "Fixture không đúng định dạng");
  }
  console.log("PASS 2 ảnh PNG + 4 PDF: storage thực, checksum đúng, private");
}
