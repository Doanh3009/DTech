"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/FormControls";
import { BusinessReference } from "./BusinessReference";
import styles from "./Business.module.css";

type Conversion = { baseQuantity: number; baseUnit: string; factor: number };

export function BusinessItemQuantityConverter({ slug }: { slug: string }) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
  const [result, setResult] = useState<Conversion | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function convert(event: FormEvent) {
    event.preventDefault();
    if (!itemId || request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError(""); setResult(null);
    try {
      const params = new URLSearchParams({ itemId, fromUnit: unit, quantity, on: date });
      const response = await fetch(`/api/v1/business/${slug}/items/convert-quantity?${params}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Chưa quy đổi được số lượng.");
      if (!controller.signal.aborted) setResult(body.data);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa quy đổi được số lượng.");
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className={styles.progressSurface} aria-label="Quy đổi số lượng">
    <h2>Quy đổi số lượng</h2>
    <form className={styles.toolbar} onSubmit={convert}>
      <BusinessReference slug={slug} kind="items" label="Vật tư" value={itemId} required disabled={busy} onChange={value => { setItemId(value); setResult(null); }} />
      <Input label="Đơn vị nhập" required maxLength={30} value={unit} disabled={busy} onChange={event => { setUnit(event.target.value); setResult(null); }} />
      <Input label="Số lượng" type="number" required min="0.0001" max="1000000000000000" step="0.0001" value={quantity} disabled={busy} onChange={event => { setQuantity(event.target.value); setResult(null); }} />
      <Input label="Ngày hiệu lực" type="date" required value={date} disabled={busy} onChange={event => { setDate(event.target.value); setResult(null); }} />
      <Button type="submit" busy={busy} disabled={!itemId}>Quy đổi</Button>
    </form>
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div className={styles.overviewMetrics} role="status"><div><span>Số lượng cơ sở</span><strong>{Number(result.baseQuantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })} {result.baseUnit}</strong></div><div><span>Hệ số</span><strong>{Number(result.factor).toLocaleString("vi-VN", { maximumFractionDigits: 8 })}</strong></div></div> : null}
  </section>;
}
