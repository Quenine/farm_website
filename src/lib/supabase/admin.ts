import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getAdminSupabaseConfig } from "@/src/lib/supabase/config";

export function createAdminSupabaseClient() {
  const { url, serviceRoleKey } = getAdminSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
