import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

export function getSupabaseServiceClient(options: { timeoutMs?: number } = {}): SupabaseClient | null {
  const env = getServerEnv();
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !supabaseSecretKey) {
    return null;
  }

  const deadlineFetch: typeof fetch = async (url, init) => {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(init?.signal?.reason);
    init?.signal?.addEventListener("abort", forwardAbort, { once: true });
    if (init?.signal?.aborted) forwardAbort();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try { return await fetch(url, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); init?.signal?.removeEventListener("abort", forwardAbort); }
  };
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, supabaseSecretKey, {
    ...(options.timeoutMs ? { global: { fetch: deadlineFetch } } : {}),
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
