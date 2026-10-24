import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { SalesFulfillmentPanel } from "./SalesFulfillmentPanel";

vi.mock("@/components/shared/Button", () => ({ Button: ({ busy, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) => <button type="button" {...props} disabled={props.disabled || busy}>{children}</button> }));
vi.mock("@/components/shared/FormControls", () => ({
 Input: ({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => <label>{label}<input {...props}/></label>,
 Select: ({ label, options, ...props }: { label: string; options: { value: string; label: string }[] }) => <label>{label}<select {...props}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}));
vi.mock("@/components/shared/DataTable", () => ({ DataTable: ({ data, ariaLabel }: { data: unknown[]; ariaLabel: string }) => <div aria-label={ariaLabel}>{JSON.stringify(data)}</div> }));
const orderId = "10000000-0000-4000-8000-000000000001";
const itemId = "10000000-0000-4000-8000-000000000002";
const warehouseId = "10000000-0000-4000-8000-000000000003";
const moveId = "10000000-0000-4000-8000-000000000004";
const snapshot = { orderId, code: "SO-01", rowVersion: 2, status: "released", items: [{ itemId, code: "ITEM-01", name: "Vật tư", unit: "cái", tracking: "none", unitCost: 0, ordered: 10, shipped: 4 }], stock: [{ itemId, warehouseId, warehouse: "Kho chính", lotId: null, lot: null, available: 20, quality: null, expiresOn: null }] };
function response(data: unknown, status = 200) { return new Response(JSON.stringify(status < 400 ? { ok: true, data } : { ok: false, error: { message: "Chưa xác nhận kết quả" } }), { status }); }
function renderPanel(viewer = false) {
 const onCommitted = vi.fn(), onBusyChange = vi.fn(), onPendingChange = vi.fn();
 render(<SalesFulfillmentPanel slug="acme" orderId={orderId} disabled={false} viewer={viewer} onCommitted={onCommitted} onBusyChange={onBusyChange} onPendingChange={onPendingChange}/>);
 return { onCommitted, onBusyChange, onPendingChange };
}
async function fill() {
 await screen.findByRole("button", { name: "Thêm hàng giao" });
 fireEvent.click(screen.getByRole("button", { name: "Thêm hàng giao" }));
 fireEvent.change(screen.getByLabelText("Kho / lô 1"), { target: { value: `${warehouseId}:none` } });
 fireEvent.change(screen.getByLabelText("Số lượng 1"), { target: { value: "6" } });
 fireEvent.click(screen.getByRole("button", { name: "Giao hàng & xuất kho" }));
}
afterEach(() => vi.unstubAllGlobals());
describe("sales delivery interaction", () => {
 it("retries the same immutable command after an ambiguous outcome", async () => {
  const commands: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
   if (!init?.body) return response(snapshot);
   commands.push(init.body as string);
   return commands.length === 1 ? response(null, 503) : response({ orderId, rowVersion: 3, stockMoveIds: [moveId] });
  }));
  const callbacks = renderPanel(); await fill();
  await screen.findByRole("button", { name: "Thử lại giao hàng cùng yêu cầu" });
  expect(screen.getByLabelText("Số lượng 1")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại giao hàng cùng yêu cầu" }));
  await waitFor(() => expect(callbacks.onCommitted).toHaveBeenCalledOnce());
  expect(commands).toHaveLength(2); expect(commands[1]).toBe(commands[0]);
  expect(JSON.parse(commands[0]).lines[0]).toEqual({ itemId, warehouseId, lotId: null, quantity: 6, unitCost: 0 });
  expect(callbacks.onPendingChange).toHaveBeenLastCalledWith(false);
 });
 it("keeps an unconfirmed receipt pending instead of reporting success", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => response(init?.body ? { orderId, rowVersion: 999, stockMoveIds: [moveId] } : snapshot)));
  const callbacks = renderPanel(); await fill();
  await screen.findByRole("button", { name: "Thử lại giao hàng cùng yêu cầu" });
  expect(callbacks.onCommitted).not.toHaveBeenCalled();
 });
 it("shows progress for a viewer without a delivery action", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response(snapshot)));
  renderPanel(true);
  await waitFor(() => expect(screen.getByLabelText("Tiến độ giao hàng")).toHaveTextContent('"remaining":6'));
  expect(screen.queryByRole("button", { name: "Giao hàng & xuất kho" })).not.toBeInTheDocument();
 });
});
