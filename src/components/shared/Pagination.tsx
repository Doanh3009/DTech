"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/shared/Button";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  return (
    <nav aria-label="Phân trang" className="pagination">
      <Button
        disabled={page <= 1}
        leftIcon={<ChevronLeft aria-hidden="true" size={16} />}
        onClick={() => onPageChange?.(page - 1)}
        variant="secondary"
      >
        Trước
      </Button>
      <span>
        Trang {page} / {pageCount}
      </span>
      <Button
        disabled={page >= pageCount}
        onClick={() => onPageChange?.(page + 1)}
        rightIcon={<ChevronRight aria-hidden="true" size={16} />}
        variant="secondary"
      >
        Sau
      </Button>
    </nav>
  );
}
