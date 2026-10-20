import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "neutral" | "blue" | "mint" | "lavender" | "orange" | "yellow" | "cyan" | "rose";
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

export function Card({ children, className, variant = "neutral", padding = "md", interactive = false }: CardProps) {
  return <section className={cn("card", "card--workspace", `card--${variant}`, `card--padding-${padding}`, interactive && "card--interactive", className)}>{children}</section>;
}

export interface StatCardProps {
  label: string;
  value: string;
  description?: string;
}

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <Card className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {description ? <p>{description}</p> : null}
    </Card>
  );
}
