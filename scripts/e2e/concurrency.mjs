import path from "node:path";
import { observePage } from "./page-ready.mjs";

export function registerConcurrencyCases(s) {
  const { test, assert, state, need, api, create, uuid } = s;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  async function race(method, route, bodies, roles = ["shipping", "admin"]) {
    return Promise.all(roles.map(async (role, index) => {
      const response = await s.context(role).request.fetch(s.baseUrl + route, { method, data: bodies[index], timeout: 60000 });
      const body = await response.json();
      s.report.timings.push({ route, method, role, status: response.status(), concurrent: true });
      return { status: response.status(), body };
    }));
  }

  test("CONCURRENT-01", "Tám vai trò đọc dữ liệu đồng thời bằng phiên riêng", async () => {
    const roles = Object.keys(s.people);
    assert.equal(roles.length, 8);
    await Promise.all(roles.map(async (role) => {
      for (let round = 0; round < 3; round++) await api(role, "GET", "/api/v1/auth/sessions");
    }));
  });

  test("CONCURRENT-02", "Hai người cập nhật ETA cùng phiên bản: một thành công, một xung đột", async () => {
    need("partner", "item", "uom");
    state.concurrentShipment = await create("shipping", "/api/v1/shipments", {
      clientRequestId: uuid(), supplierId: state.partner.id, transportMode: "sea", status: "booked",
      currentEta: today, lines: [{ itemId: state.item.id, expectedQuantity: 10, uomId: state.uom.id }]
    }, "shipments");
    const route = `/api/v1/shipments/${state.concurrentShipment.id}/update-eta`;
    const inputs = ["2026-11-12", "2026-11-13"].map(newValue => ({ newValue, source: "manual", reason: "E2E concurrent ETA", rowVersion: state.concurrentShipment.rowVersion, clientRequestId: uuid() }));
    const results = await race("POST", route, inputs);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409], JSON.stringify(results));
    const shipment = await api("shipping", "GET", `/api/v1/shipments/${state.concurrentShipment.id}`);
    assert.equal(shipment.rowVersion, state.concurrentShipment.rowVersion + 1);
    assert.equal(shipment.scheduleHistory.length, 1);
    assert(inputs.some(input => input.newValue === shipment.currentEta));
    state.concurrentShipment = shipment;
  });

  test("CONCURRENT-03", "Hai người sửa thông quan cùng phiên bản không ghi đè nhau", async () => {
    need("concurrentShipment");
    const route = `/api/v1/shipments/${state.concurrentShipment.id}/customs`;
    const before = state.concurrentShipment.customs;
    const inputs = ["A", "B"].map(value => ({ ...before, declarationNumber: `E2E-CONCURRENT-${value}`, status: "preparing_documents" }));
    const results = await race("PATCH", route, inputs);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409], JSON.stringify(results));
    const shipment = await api("shipping", "GET", `/api/v1/shipments/${state.concurrentShipment.id}`);
    assert.equal(shipment.customs.rowVersion, before.rowVersion + 1);
    state.concurrentShipment = shipment;
  });

  test("CONCURRENT-04", "Gửi lập phiếu nhập đồng thời cùng mã yêu cầu chỉ tạo một phiếu", async () => {
    need("concurrentShipment");
    state.concurrentWarehouse = await create("warehouse", "/api/v1/warehouses", { code: `${s.fixture.prefix}_RACE`, name: "[E2E] Kho kiểm thử đồng thời" }, "warehouses");
    await s.fixture.query(s.fixture.db.from("warehouse_user_scopes").insert({ warehouse_id: state.concurrentWarehouse.id, account_id: s.people.shipping.accountId, can_view: true, can_operate: true }), "concurrent shipping scope");
    const shipment = state.concurrentShipment;
    const body = { clientRequestId: uuid(), warehouseId: state.concurrentWarehouse.id, receivedDate: today, lines: [{ shipmentLineId: shipment.lines[0].id, quantity: 5 }] };
    const results = await race("POST", `/api/v1/shipments/${shipment.id}/create-warehouse-receipt`, [body, body]);
    assert(results.every(result => [200, 201].includes(result.status)), JSON.stringify(results));
    assert.equal(results[0].body.data.id, results[1].body.data.id);
    state.concurrentReceipt = results[0].body.data;
    await s.fixture.track("inventory_documents", state.concurrentReceipt.id);
    const summary = await api("shipping", "GET", `/api/v1/shipments/${shipment.id}/receiving`);
    assert.equal(summary.receipts.length, 1);
    assert.equal(summary.receivedQuantity, 0, "Phiếu nháp chưa làm tăng thực nhận");
  });

  test("CONCURRENT-05", "Ghi sổ cùng phiếu từ hai phiên chỉ tăng tồn và thực nhận một lần", async () => {
    need("concurrentReceipt", "concurrentShipment", "concurrentWarehouse", "item");
    const rows = await api("warehouse", "GET", `/api/v1/warehouse/inventory?warehouseId=${state.concurrentWarehouse.id}&itemId=${state.item.id}`);
    const before = rows.find(row => row.itemId === state.item.id)?.onHand ?? 0;
    const body = { postingDate: today, idempotencyKey: uuid() };
    const page = await s.page("shipping", `/import-export/shipments/${state.concurrentShipment.id}/receiving`);
    const started = performance.now();
    const results = await race("POST", `/api/v1/warehouse/receipts/${state.concurrentReceipt.id}/post`, [body, body], ["warehouse", "admin"]);
    try {
      await page.waitForFunction(() => document.querySelector('section:not([hidden]) [role="progressbar"]')?.getAttribute("aria-valuenow") === "50", undefined, { timeout: 65000 });
      s.report.timings.push({ kind: "receiving-cross-session-sync", ms: Math.round(performance.now() - started) });
    } finally { await page.close(); }
    assert(results.every(result => [200, 201].includes(result.status)), JSON.stringify(results));
    const after = await api("warehouse", "GET", `/api/v1/warehouse/inventory?warehouseId=${state.concurrentWarehouse.id}&itemId=${state.item.id}`);
    assert.equal(after.find(row => row.itemId === state.item.id)?.onHand, before + 5);
    const summary = await api("shipping", "GET", `/api/v1/shipments/${state.concurrentShipment.id}/receiving`);
    assert.equal(summary.receivedQuantity, 5);
    assert.equal(summary.remainingQuantity, 5);
  });

  test("CONCURRENT-06", "Hai phiếu khác nhau ghi sổ đồng thời không nhận vượt lô hàng", async () => {
    need("concurrentShipment", "concurrentWarehouse", "concurrentReceipt");
    const shipment = state.concurrentShipment;
    const before = await api("shipping", "GET", `/api/v1/shipments/${shipment.id}/receiving`);
    assert.equal(before.receivedQuantity, 5);
    const receipts = await Promise.all([1, 2].map(() => api("shipping", "POST", `/api/v1/shipments/${shipment.id}/create-warehouse-receipt`, {
      clientRequestId: uuid(), warehouseId: state.concurrentWarehouse.id, receivedDate: today,
      lines: [{ shipmentLineId: shipment.lines[0].id, quantity: 4 }]
    })));
    for (const receipt of receipts) await s.fixture.track("inventory_documents", receipt.id);
    const responses = await Promise.all(receipts.map((receipt, index) => s.context(index ? "admin" : "warehouse").request.post(`${s.baseUrl}/api/v1/warehouse/receipts/${receipt.id}/post`, { data: { postingDate: today, idempotencyKey: uuid() } })));
    assert.deepEqual(responses.map(response => response.status()).sort(), [200, 409]);
    const summary = await api("shipping", "GET", `/api/v1/shipments/${shipment.id}/receiving`);
    assert.equal(summary.receivedQuantity, 9);
    assert.equal(summary.remainingQuantity, 1);
  });

  test("UI-SHIPMENT-NAV", "Đổi cả bảy tab giữ trang, bản nháp và không tải lại dữ liệu lô hàng", async () => {
    need("concurrentShipment");
    const base = `/import-export/shipments/${state.concurrentShipment.id}`;
    const page = await s.page("shipping", `${base}/containers`, 1920);
    const observer = observePage(page);
    const documents = [], shipmentReads = [];
    page.on("request", request => {
      if (request.resourceType() === "document") documents.push(request.url());
      if (new URL(request.url()).pathname === `/api/v1/shipments/${state.concurrentShipment.id}`) shipmentReads.push(request.url());
    });
    try {
      await page.getByRole("textbox", { name: /^Số container/ }).fill("DRAFT1234567");
      const marker = uuid();
      await page.evaluate(value => { window.__shipmentNavigationMarker = value; }, marker);
      for (const section of ["overview", "lines", "documents", "customs", "receiving", "history", "containers"]) {
        await page.locator(`nav[aria-label="Chi tiết lô hàng"] a[href="${base}/${section}"]`).click();
        await page.waitForURL(url => url.pathname === `${base}/${section}`);
        await page.locator(`nav[aria-label="Chi tiết lô hàng"] a[aria-current="page"][href="${base}/${section}"]`).waitFor();
        await observer.ready();
      }
      assert.equal(await page.getByRole("textbox", { name: /^Số container/ }).inputValue(), "DRAFT1234567");
      assert.equal(await page.evaluate(() => window.__shipmentNavigationMarker), marker);
      assert.deepEqual(documents, [], "Tab navigation must retain the current document");
      assert.deepEqual(shipmentReads, [], "Tab navigation must retain loaded shipment data");
      await page.goBack();
      await page.waitForURL(url => url.pathname === `${base}/history`);
      await page.goForward();
      await page.waitForURL(url => url.pathname === `${base}/containers`);
      assert.equal(await page.getByRole("textbox", { name: /^Số container/ }).inputValue(), "DRAFT1234567");
      for (const section of ["containers", "receiving", "customs", "documents", "overview"]) {
        await page.locator(`nav[aria-label="Chi tiết lô hàng"] a[href="${base}/${section}"]`).click();
        await page.waitForURL(url => url.pathname === `${base}/${section}`);
        await observer.ready();
        for (const width of [1920, 1366, 768, 390, 375]) {
          await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
          const layout = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
          assert(layout.content <= layout.viewport + 1, `${section}: tràn ngang ${layout.content}/${layout.viewport}`);
          await page.screenshot({ path: path.join(s.output, `shipment-${section}-${width}.png`), fullPage: true });
        }
        await page.setViewportSize({ width: 1920, height: 1000 });
      }
      for (const route of ["shipments", "transport", "customs", "contracts", "documents", "partners"]) {
        const target = `/import-export/${route}`;
        const started = performance.now();
        await page.locator(`.app-rail a[href="${target}"]`).click();
        await page.waitForURL(url => url.pathname === target);
        await observer.ready();
        assert.equal(await page.evaluate(() => window.__shipmentNavigationMarker), marker);
        s.report.timings.push({ route: target, kind: "sidebar-navigation", ms: Math.round(performance.now() - started) });
      }
      assert.deepEqual(documents, [], "Điều hướng menu giữ nguyên document và phiên làm việc");
      assert.deepEqual(observer.errors, [], "Điều hướng không có lỗi runtime hoặc HTTP 5xx");
    } finally { await page.close(); }
  }, "BROWSER");
}
