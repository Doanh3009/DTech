import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal(""))
});

const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SECRET_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  APP_TIMEZONE: z.string().default("Asia/Ho_Chi_Minh"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  WEBHOOK_SIGNING_SECRET: z.string().optional().or(z.literal("")),
  API_KEY_PEPPER: z.string().optional().or(z.literal("")),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional().or(z.literal("")),
  INTEGRATION_WORKER_SECRET: z.string().optional().or(z.literal("")),
  OPERATIONS_CRON_SECRET: z.string().optional().or(z.literal("")),
  SESSION_HASH_PEPPER: z.string().optional().or(z.literal("")),
  BACKUP_LAST_VERIFIED_AT: z.string().datetime().optional().or(z.literal("")),
  RELEASE_SHA: z.string().max(128).default("development"),
  RELEASE_ENVIRONMENT: z.enum(["development", "staging", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getClientEnv(): ClientEnv {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    APP_BASE_URL: process.env.APP_BASE_URL,
    WEBHOOK_SIGNING_SECRET: process.env.WEBHOOK_SIGNING_SECRET,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    INTEGRATION_WORKER_SECRET: process.env.INTEGRATION_WORKER_SECRET,
    OPERATIONS_CRON_SECRET: process.env.OPERATIONS_CRON_SECRET,
    SESSION_HASH_PEPPER: process.env.SESSION_HASH_PEPPER,
    BACKUP_LAST_VERIFIED_AT: process.env.BACKUP_LAST_VERIFIED_AT,
    RELEASE_SHA: process.env.RELEASE_SHA,
    RELEASE_ENVIRONMENT: process.env.RELEASE_ENVIRONMENT,
    LOG_LEVEL: process.env.LOG_LEVEL
  });
}

export function isSupabaseConfigured(env: ClientEnv = getClientEnv()): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
