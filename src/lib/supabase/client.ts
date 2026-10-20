import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getClientEnv, isSupabaseConfigured } from "@/lib/env";

let browserClient: SupabaseClient | null = null;
let realtimeAuthPromise: Promise<SupabaseClient | null> | null = null;
let realtimeAuthenticatedUntil = 0;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const env = getClientEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSupabaseConfigured(env) || !supabaseUrl || !supabasePublicKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublicKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  return browserClient;
}

export async function getAuthenticatedSupabaseRealtimeClient(force = false): Promise<SupabaseClient | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  if (!force && Date.now() < realtimeAuthenticatedUntil - 60_000) return client;
  if (realtimeAuthPromise) return realtimeAuthPromise;
  realtimeAuthPromise = (async () => {
    try {
      const response = await fetch("/api/v1/auth/realtime-token", { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as { data?: { accessToken?: string; expiresAt?: string } };
      const token = body.data?.accessToken;
      if (!response.ok || !token) return null;
      await client.realtime.setAuth(token);
      const expiresAt = Date.parse(body.data?.expiresAt ?? "");
      realtimeAuthenticatedUntil = Number.isFinite(expiresAt) ? expiresAt : Date.now() + 5 * 60_000;
      return client;
    } catch {
      return null;
    } finally {
      realtimeAuthPromise = null;
    }
  })();
  return realtimeAuthPromise;
}

export async function refreshSupabaseRealtimeAuthentication(): Promise<boolean> {
  return Boolean(await getAuthenticatedSupabaseRealtimeClient(true));
}

export function clearSupabaseRealtimeAuthentication(): void {
  realtimeAuthenticatedUntil = 0;
  realtimeAuthPromise = null;
  browserClient?.realtime.disconnect();
}
