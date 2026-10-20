"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Select } from "@/components/shared/FormControls";
import type { Shift } from "../types/timesheetTypes";

export function ShiftAssignmentForm({
  shifts,
  onAssigned
}: {
  shifts: Shift[];
  onAssigned?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [scopeType, setScopeType] = useState("company");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/shifts/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shiftId: form.get("shiftId"),
        scopeType,
        scopeId: scopeType === "company" ? undefined : form.get("scopeId"),
        effectiveFrom: form.get("effectiveFrom"),
        effectiveTo: form.get("effectiveTo") || undefined,
        weekdays: [1, 2, 3, 4, 5]
      })
    });
    const body = await response.json();
    setMessage(response.ok ? "Đã gán ca." : body.error?.message ?? "Không thể gán ca.");
    setSaving(false);
    if (response.ok) onAssigned?.();
  }

  return (
    <Card>
      <h3 className="section-title">Gán ca</h3>
      <form className="form-grid" onSubmit={submit}>
        <Select label="Ca" name="shiftId" options={shifts.map((shift) => ({ label: shift.name, value: shift.id }))} required />
        <Select
          label="Phạm vi"
          name="scopeType"
          onChange={(event) => setScopeType(event.target.value)}
          options={[
            { value: "company", label: "Công ty" },
            { value: "department", label: "Phòng ban" },
            { value: "project", label: "Dự án" },
            { value: "employee", label: "Nhân viên" }
          ]}
          value={scopeType}
        />
        {scopeType !== "company" ? <Input label="Mã phạm vi" name="scopeId" required /> : null}
        <Input label="Hiệu lực từ" name="effectiveFrom" required type="date" />
        <Input label="Hiệu lực đến" name="effectiveTo" type="date" />
        <div className="form-actions">
          <Button disabled={saving || shifts.length === 0} type="submit" variant="primary">
            {saving ? "Đang gán" : "Gán ca"}
          </Button>
        </div>
        {message ? <p aria-live="polite">{message}</p> : null}
      </form>
    </Card>
  );
}
