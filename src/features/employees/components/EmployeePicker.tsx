"use client";

import { useMemo, useState } from "react";

import { SearchInput } from "@/components/shared/FormControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { EmployeePickerOption, WorkerCategory } from "@/features/employees/types";
import { employeeStatusMeta, workerCategoryLabels } from "@/features/employees/services/employeeService";

export interface EmployeePickerProps {
  label: string;
  options: EmployeePickerOption[];
  workerCategory?: WorkerCategory;
  selectedId?: string;
  onSelect?: (option: EmployeePickerOption) => void;
}

export function EmployeePicker({ label, options, workerCategory, selectedId, onSelect }: EmployeePickerProps) {
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return options
      .filter((option) => !workerCategory || option.workerCategory === workerCategory)
      .filter((option) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          option.employeeCode,
          option.displayName,
          option.departmentName,
          option.positionName
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .slice(0, 6);
  }, [options, query, workerCategory]);

  return (
    <section className="employee-picker" aria-label={label}>
      <SearchInput
        label={label}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Tìm theo tên, mã hoặc phòng ban"
        value={query}
      />
      <div className="employee-picker__list">
        {filteredOptions.map((option) => (
          <button
            aria-pressed={selectedId === option.id}
            className={`employee-picker__item${selectedId === option.id ? " is-selected" : ""}`}
            key={option.id}
            onClick={() => onSelect?.(option)}
            type="button"
          >
            <span>
              <strong>{option.displayName}</strong>
              <small>
                {option.departmentName} · {option.positionName}
              </small>
            </span>
            <StatusBadge tone={employeeStatusMeta[option.employmentStatus].tone}>
              {workerCategoryLabels[option.workerCategory]}
            </StatusBadge>
          </button>
        ))}
      </div>
    </section>
  );
}

export function WorkerSelector(props: Omit<EmployeePickerProps, "workerCategory">) {
  return <EmployeePicker {...props} workerCategory="worker" />;
}
