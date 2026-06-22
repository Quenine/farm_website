import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function getAdminEmail() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is not configured.");
  }
  return adminEmail;
}

export function isOwnerEmail(email: string | null | undefined) {
  return normalizeEmail(email) === getAdminEmail();
}

export async function getAuthenticatedAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isOwnerEmail(user.email)) {
    return null;
  }

  return user;
}

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }
  if (!isOwnerEmail(user.email)) {
    redirect("/admin/login?error=unauthorized");
  }
  return user;
}
