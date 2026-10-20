"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Select, Textarea } from "@/components/shared/FormControls";

import styles from "./ProjectCreateForm.module.css";

export function ProjectCreateForm() {
  const router = useRouter();
  const pending = useRef(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    pending.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45_000)
      });
      const body = await response.json() as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể tạo gói.");
      router.push(`/projects/${body.data.id}/today`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo gói.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <div className={styles.page}><Card className={styles.card}>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fields} disabled={saving}>
        <h2 className={styles.mobileHeading}>Thông tin gói</h2>
        <div className={styles.compactRow}><Input label="Mã gói" maxLength={40} minLength={2} name="code" required /><Select label="Trạng thái" name="status" options={[{ label: "Chuẩn bị", value: "preparing" }, { label: "Đang thực hiện", value: "active" }]} /></div>
        <Input label="Tên gói" maxLength={180} minLength={3} name="name" required /><Input label="Khách hàng" maxLength={160} name="customerName" />
        <h2 className={styles.mobileHeading}>Tiến độ dự kiến</h2>
        <div className={styles.dateRow}><Input label="Ngày bắt đầu" name="startDate" onChange={event => setStartDate(event.target.value)} required type="date" value={startDate} /><Input label="Kết thúc dự kiến" min={startDate || undefined} name="expectedEndDate" type="date" /></div>
        <div className={styles.summary}><Textarea label="Tóm tắt" maxLength={500} name="summary" /></div>
      </fieldset>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      <div className={styles.actions}>
        {saving ? <Button disabled variant="secondary">Hủy</Button> : <Link className="button button--secondary button--md" href="/projects">Hủy</Link>}
        <Button busy={saving} leftIcon={<Save aria-hidden="true" size={16} />} type="submit" variant="primary">Tạo gói</Button>
      </div>
    </form>
  </Card></div>;
}
