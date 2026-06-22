"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export async function logoutAdmin() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
