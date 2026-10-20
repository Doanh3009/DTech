import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

export function getSupabaseServiceClient(): SupabaseClient | null {
  const env = getServerEnv();
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !supabaseSecretKey) {
    return null;
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
