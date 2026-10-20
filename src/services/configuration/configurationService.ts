import { z } from "zod";

export const configurationKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_.-]*$/, "Khóa cấu hình chỉ dùng chữ thường, số, dấu chấm, gạch ngang.");

export interface ConfigurationValue<TValue = unknown> {
  key: string;
  value: TValue;
  scope: "global" | "module" | "user";
  updatedAt: string;
  updatedBy?: string;
}

const inMemoryConfiguration = new Map<string, ConfigurationValue>();

export async function getConfiguration<TValue>(
  key: string
): Promise<ConfigurationValue<TValue> | null> {
  configurationKeySchema.parse(key);
  return (inMemoryConfiguration.get(key) as ConfigurationValue<TValue> | undefined) ?? null;
}

export async function setConfiguration<TValue>(
  value: ConfigurationValue<TValue>
): Promise<ConfigurationValue<TValue>> {
  configurationKeySchema.parse(value.key);
  inMemoryConfiguration.set(value.key, value);
  return value;
}
