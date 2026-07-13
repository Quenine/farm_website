import "server-only";

import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";

export function hasContentAdminDataClient() {
  return hasAdminSupabaseConfig();
}

export function createContentAdminSupabaseClient() {
  return createAdminSupabaseClient();
}
