"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/admin-auth";
import { siteConfig } from "@/src/config/site";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";

const settingKey = () => `launch_checklist:${siteConfig.domain}`;

export async function saveLaunchChecklistAction(checked: string[]) {
  const user = await requireAdmin();
  const clean = [...new Set(checked.filter((item) => /^[a-z0-9:_-]{1,100}$/.test(item)))].slice(0, 200);
  const value = { checked: clean, checkedBy: user.email ?? "admin", updatedAt: new Date().toISOString(), brand: siteConfig.name };
  const { error } = await createAdminSupabaseClient().from("app_settings").upsert({ key: settingKey(), value }, { onConflict: "key" });
  if (error) return { ok: false, message: "Checklist state could not be saved." };
  revalidatePath("/admin/launch-checklist");
  return { ok: true, message: "Checklist saved." };
}

export async function resetLaunchChecklistAction() {
  const user = await requireAdmin();
  const value = { checked: [], checkedBy: user.email ?? "admin", updatedAt: new Date().toISOString(), brand: siteConfig.name };
  const { error } = await createAdminSupabaseClient().from("app_settings").upsert({ key: settingKey(), value }, { onConflict: "key" });
  if (error) return { ok: false, message: "Checklist state could not be reset." };
  revalidatePath("/admin/launch-checklist");
  return { ok: true, message: "Checklist reset." };
}
