"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { FilterBar } from "@/components/shared/FilterBar";
import { SearchInput, Select, type SelectOption } from "@/components/shared/FormControls";

interface EmployeeListFiltersProps {
  defaults: Record<string, string | number | undefined>;
  departments: SelectOption[];
  positions: SelectOption[];
  employmentTypes: SelectOption[];
  statuses: SelectOption[];
}

export function EmployeeListFilters({ defaults, departments, positions, employmentTypes, statuses }: EmployeeListFiltersProps) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["q", "departmentId", "positionId", "employmentTypeId", "status"] as const) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    params.set("page", "1");
    params.set("pageSize", String(defaults.pageSize ?? 10));
    startTransition(() => router.push(`/employees?${params.toString()}`));
  }

  return (
    <form key={JSON.stringify(defaults)} onSubmit={apply}>
      <FilterBar
        actions={
          <>
            <Button disabled={loading} leftIcon={<Search aria-hidden="true" size={16} />} type="submit" variant="primary">Lọc</Button>
            <Button disabled={loading} onClick={() => startTransition(() => router.push("/employees"))} type="button">Xóa</Button>
          </>
        }
        className="employee-filter-bar"
      >
        <SearchInput defaultValue={defaults.q} label="Tìm nhân viên" name="q" placeholder="Tìm mã, tên, SĐT" />
        <Select defaultValue={defaults.departmentId ?? ""} label="Phòng ban" labelHidden name="departmentId" options={departments} placeholder="Phòng ban: Tất cả" />
        <Select defaultValue={defaults.positionId ?? ""} label="Chức vụ" labelHidden name="positionId" options={positions} placeholder="Chức vụ: Tất cả" />
        <Select defaultValue={defaults.employmentTypeId ?? ""} label="Nhóm làm việc" labelHidden name="employmentTypeId" options={employmentTypes} placeholder="Nhóm: Tất cả" />
        <Select defaultValue={defaults.status ?? ""} label="Trạng thái" labelHidden name="status" options={statuses} placeholder="Trạng thái: Tất cả" />
      </FilterBar>
    </form>
  );
}
