import { appConfig } from "@/config/app";

export function formatBusinessDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(appConfig.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: appConfig.timezone
  }).format(date);
}

export function formatBusinessDate(value: Date | string): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+07:00`)
    : typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(appConfig.locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: appConfig.timezone
  }).format(date);
}

export function nowServerReceivedAt(): string {
  return new Date().toISOString();
}

/** Returns a YYYY-MM-DD key in the configured business timezone. */
export function getBusinessDateKey(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date value");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: appConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const valueByPart = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueByPart.get("year")}-${valueByPart.get("month")}-${valueByPart.get("day")}`;
}
