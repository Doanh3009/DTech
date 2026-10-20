"use client";

import { CalendarRange, Download, Filter, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef } from "react";

import { Button } from "@/components/shared/Button";
import { ColumnVisibilityMenu } from "@/components/shared/ColumnVisibilityMenu";
import type { DataTableColumn } from "@/components/shared/DataTable";
import { FilterBar, FilterChip } from "@/components/shared/FilterBar";
import { Input, SearchInput, Select } from "@/components/shared/FormControls";

interface ListToolbarProps<TData extends object> {
  columns: DataTableColumn<TData>[];
  moduleName: string;
  dateRange?: boolean;
}

function getSingleParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? "";
}

export function ListToolbar<TData extends object>({
  columns,
  moduleName,
  dateRange = true
}: ListToolbarProps<TData>) {
  return (
    <Suspense
      fallback={
        <div className="filter-bar" aria-hidden="true">
          <div className="filter-bar__controls">
            <span className="skeleton toolbar-skeleton" />
          </div>
        </div>
      }
    >
      <ListToolbarContent columns={columns} dateRange={dateRange} moduleName={moduleName} />
    </Suspense>
  );
}

function ListToolbarContent<TData extends object>({
  columns,
  moduleName,
  dateRange = true
}: ListToolbarProps<TData>) {
  const pathname = usePathname();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const params = useSearchParams();
  const query = getSingleParam(params, "q");
  const status = getSingleParam(params, "status");
  const from = getSingleParam(params, "from");
  const to = getSingleParam(params, "to");

  const activeFilters = [
    query ? { label: "Từ khóa", value: query } : null,
    status ? { label: "Trạng thái", value: status } : null,
    from ? { label: "Từ ngày", value: from } : null,
    to ? { label: "Đến ngày", value: to } : null
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <form action={pathname} className="list-toolbar" method="get" ref={formRef}>
      <FilterBar
        onApply={() => formRef.current?.requestSubmit()}
        onReset={() => { formRef.current?.reset(); router.push(pathname); }}
        actions={
          <>
            <ColumnVisibilityMenu
              columns={columns.map((column) => ({
                id: column.id,
                label: column.header,
                visible: true
              }))}
            />
            <Button leftIcon={<Download aria-hidden="true" size={16} />} variant="secondary">
              Xuất
            </Button>
            <Button leftIcon={<Filter aria-hidden="true" size={16} />} type="submit" variant="secondary">
              Lọc
            </Button>
          </>
        }
      >
        <SearchInput
          defaultValue={query}
          label={`Tìm trong ${moduleName.toLowerCase()}`}
          name="q"
          placeholder={`Tìm trong ${moduleName.toLowerCase()}`}
        />
        <Select
          defaultValue={status}
          label="Trạng thái"
          name="status"
          options={[
            { label: "Đang xử lý", value: "pending" },
            { label: "Đã hoàn tất", value: "done" },
            { label: "Cần chú ý", value: "attention" }
          ]}
          placeholder="Tất cả"
        />
        {dateRange ? (
          <div className="toolbar-date-range">
            <CalendarRange aria-hidden="true" size={17} />
            <Input defaultValue={from} label="Từ ngày" name="from" type="date" />
            <Input defaultValue={to} label="Đến ngày" name="to" type="date" />
          </div>
        ) : null}
      </FilterBar>
      {activeFilters.length > 0 ? (
        <div className="active-filter-row" aria-label="Bộ lọc đang áp dụng">
          {activeFilters.map((filter) => (
            <FilterChip key={filter.label} label={filter.label} value={filter.value} />
          ))}
          <Link className="button button--secondary button--md" href={pathname}>
            <RotateCcw aria-hidden="true" size={16} />
            <span>Xóa lọc</span>
          </Link>
        </div>
      ) : null}
    </form>
  );
}
