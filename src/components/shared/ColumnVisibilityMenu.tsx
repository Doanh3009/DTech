"use client";

import type { ReactNode } from "react";
import { Columns3 } from "lucide-react";

import { Checkbox } from "@/components/shared/FormControls";

export interface ColumnVisibilityOption {
  id: string;
  label: string;
  visible: boolean;
}

export interface ColumnVisibilityMenuProps {
  columns: ColumnVisibilityOption[];
  onToggle?: (columnId: string, visible: boolean) => void;
}

export function ColumnVisibilityMenu({ columns, onToggle }: ColumnVisibilityMenuProps) {
  return (
    <details className="dropdown">
      <summary aria-label="Hiển thị cột">
        <Columns3 aria-hidden="true" size={18} />
        <span>Cột</span>
      </summary>
      <div className="dropdown__content">
        {columns.map((column) => (
          <Checkbox
            checked={column.visible}
            key={column.id}
            label={column.label}
            onChange={(event) => onToggle?.(column.id, event.target.checked)}
          />
        ))}
      </div>
    </details>
  );
}

export function DropdownPanel({ children }: { children: ReactNode }) {
  return <div className="dropdown__content">{children}</div>;
}
