"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";

export async function updateInquiryStatusAction(id: string, status: string) {
  await requireAdmin();
  const parsedId = z.string().uuid().parse(id);
  const parsedStatus = z.enum(["new","in_progress","resolved","spam"]).parse(status);
  const result = await createAdminSupabaseClient().from("contact_inquiries").update({ status: parsedStatus, updated_at: new Date().toISOString() }).eq("id", parsedId);
  if (result.error) return { success: false, message: result.error.message };
  revalidatePath("/admin/inquiries");
  return { success: true, message: `Inquiry marked ${parsedStatus.replaceAll("_", " ")}.` };
}
