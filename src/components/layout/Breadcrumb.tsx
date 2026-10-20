import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { navigationIconSizes } from "@/components/layout/icons";

import type { BreadcrumbItem } from "@/config/routeRegistry";

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !isLast ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
              {!isLast ? <ChevronRight aria-hidden="true" size={navigationIconSizes.compact} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
