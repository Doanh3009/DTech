"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { DataTable } from "@/components/shared/DataTable";
import { Input, Select } from "@/components/shared/FormControls";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";
import type { CalendarDay } from "../types/timesheetTypes";

const dayTypeLabels: Record<CalendarDay["dayType"], string> = {
  holiday: "Ngày lễ",
  company_holiday: "Ngày nghỉ của công ty",
  makeup_workday: "Ngày làm bù",
  special: "Ngày đặc biệt"
};

const scopeLabels: Record<CalendarDay["scopeType"], string> = {
  company: "Toàn công ty",
  department: "Phòng ban",
  project: "Dự án",
  employee: "Nhân viên"
};

export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function parseCalendarDate(value: string): string | undefined {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return undefined;
  return `${year}-${month}-${day}`;
}

export function CalendarSettings() {
  const [items, setItems] = useState<CalendarDay[]>([]);
  const [error, setError] = useState("");
  const [dayType, setDayType] = useState<CalendarDay["dayType"]>("holiday");
  const [dayClassification, setDayClassification] = useState<"working" | "non_working">("non_working");
  const load = useCallback(() => fetch("/api/v1/work-calendar").then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message);
    setItems(body.data);
  }), []);

  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);
  useDomainReconciliation("timesheets", load);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const date = parseCalendarDate(String(form.get("date") ?? ""));
    if (!date) {
      setError("Ngày áp dụng phải đúng định dạng ngày/tháng/năm, ví dụ 30/04/2026.");
      return;
    }
    const response = await fetch("/api/v1/work-calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, name: form.get("name"), dayType, scopeType: "company", isWorkingDay: dayClassification === "working", active: true })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "Không thể lưu lịch làm việc.");
      return;
    }
    setError("");
    formElement.reset();
    setDayType("holiday");
    setDayClassification("non_working");
    await load();
  }

  function changeDayType(value: CalendarDay["dayType"]) {
    setDayType(value);
    if (value === "makeup_workday") setDayClassification("working");
    if (value === "holiday" || value === "company_holiday") setDayClassification("non_working");
  }

  return <div className="content-grid content-grid--two calendar-settings">
    <Card>
      <DataTable<CalendarDay> columns={[
        { id: "date", header: "Ngày áp dụng", cell: item => formatCalendarDate(item.date) },
        { id: "name", header: "Tên ngày", accessor: "name", priority: "primary" },
        { id: "type", header: "Phân loại", cell: item => dayTypeLabels[item.dayType] },
        { id: "scope", header: "Phạm vi", cell: item => scopeLabels[item.scopeType] },
        { id: "mode", header: "Chế độ tính công", cell: item => item.isWorkingDay ? "Ngày làm việc" : "Ngày nghỉ" }
      ]} data={items} emptyDescription="" emptyTitle="Chưa thiết lập ngày nghỉ hoặc ngày làm bù" getRowId={item => item.id} />
    </Card>
    <Card>
      <h3 className="section-title">Thêm ngày nghỉ hoặc ngày làm bù</h3>
      <form className="leave-form" onSubmit={submit}>
        <Input autoComplete="off" inputMode="numeric" label="Ngày áp dụng (ngày/tháng/năm)" name="date" pattern="\d{2}/\d{2}/\d{4}" placeholder="dd/mm/yyyy" required />
        <Input label="Tên ngày" name="name" required />
        <Select label="Phân loại ngày" name="dayType" onChange={(event) => changeDayType(event.target.value as CalendarDay["dayType"])} options={Object.entries(dayTypeLabels).map(([value, label]) => ({ value, label }))} value={dayType} />
        <Select label="Chế độ tính công" name="dayClassification" onChange={(event) => setDayClassification(event.target.value as "working" | "non_working")} options={[{ value: "non_working", label: "Ngày nghỉ — không tính ngày công" }, { value: "working", label: "Ngày làm việc — tính ngày công" }]} value={dayClassification} />
        <div className="form-actions"><Button type="submit" variant="primary">Lưu lịch</Button></div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </Card>
  </div>;
}
